const request = require('supertest');
const {ObjectID} = require('mongodb');
const _ = require('lodash');

const {app} = require('../server');
const { Todo } = require('../models/todo');
const {User} = require('../models/user');
const {todos, populateTodos, users, populateUsers} = require('./seed/seed');

beforeEach(populateUsers);
beforeEach(populateTodos);

describe('POST /todos', () => {
    test('it should create a todo', (done) => {
        var text = 'Test todo text';
        
        const response = request(app)
            .post('/todos')
            .send({text})
            .expect(200)
            .expect((res) => {
                expect(res.body.text).toBe(text);
            })
            .end((err, res) => {
                if(err) return done(err);

                Todo.find({text}).then((todos) => {
                    expect(todos.length).toBe(1);
                    expect(todos[0].text).toBe(text);
                    done();
                }).catch((e) => done(e));
            });
    });

    test('it should not create a todo with invalid body data', (done) => {
        request(app)
            .post('/todos')
            .send({})
            .expect(400)
            .end((err, res) => {
                if (err) return done(err);

                Todo.find().then((todos) => {
                    expect(todos.length).toBe(2);
                    done();
                }).catch((e) => done(e));
            });
    });
});

describe('GET /todos', () => {
    test('it should get all todos', (done) => {
        request(app)
            .get('/todos')
            .expect(200)
            .expect((res) => {
                expect(res.body.todos.length).toBe(2);
            })
            .end(done);
    });
});

describe('GET /todos/:id', () => {
    test('it should return a todo doc', (done) => {
        request(app)
            .get(`/todos/${todos[0]._id.toHexString()}`)
            .expect(200)
            .expect((res) => {
                expect(res.body.todo.text).toBe(todos[0].text);
            })
            .end(done);
    });

    test('it should return 404 if todo not found', (done) => {
        const hexId = new ObjectID().toHexString();
        request(app)
            .get(`/todos/${hexId}`)
            .expect(404)
            .end(done);
    });

    test('it should return 404 for non-object ids', (done) => {
        request(app)
            .get('/todos/123')
            .expect(404)
            .end(done);
    });
});

describe('DELETE /todos/:id', () => {
    test('it should remove a todo', (done) => {
        var hexId = todos[1]._id.toHexString();

        request(app)
            .delete(`/todos/${hexId}`)
            .expect(200)
            .expect((res) => {
                expect(res.body.todo._id).toBe(hexId);
            })
            .end((err, res) => {
                if(err)  return done(err);

                Todo.findById(hexId).then((todo) => {
                    expect(todo).toBeNull();
                    done();
                }).catch((e) => done(e));
            });
    });

    test('it should return 404 if todo not found', (done) => {
        const hexId = new ObjectID().toHexString();
        request(app)
            .delete(`/todos/${hexId}`)
            .expect(404)
            .end(done);
    });

    test('it should return 404 if object id is invalid', (done) => {
        request(app)
            .delete('/todos/123')
            .expect(404)
            .end(done);
    });
});

describe('PATCH /todos/:id', () => {
    test('it should update the todo', (done) => {
        const id = todos[0]._id.toHexString();
        const text = 'first note updated';
        request(app)
            .patch(`/todos/${id}`)
            .send({text: text, completed: true})
            .expect(200)
            .expect((res) => {
                const todo = res.body.todo;
                expect(todo.text).toBe(text);
                expect(todo.completed).toBe(true);
                expect(_.isNumber(todo.completedAt)).toBe(true);
            })
            .end(done);
    });

    test('it should clear completedAt when todo is not completed', (done) => {
        const id = todos[1]._id.toHexString();
        request(app)
            .patch(`/todos/${id}`)
            .send({text: 'second note updated', completed: false})
            .expect(200)
            .expect((res) => {
                const todo = res.body.todo;
                expect(todo.text).toBe('second note updated');
                expect(todo.completed).toBe(false);
                expect(todo.completedAt).toBeNull();
            })
            .end(done);
    });
});

describe('GET /users/me', () => {
    test('it should return user if authenticated', (done) => {
        request(app)
            .get('/users/me')
            .set('x-auth', users[0].tokens[0].token)
            .expect(200)
            .expect((res) => {
                expect(res.body._id).toBe(users[0]._id.toHexString());
                expect(res.body.email).toBe(users[0].email);
            })
            .end(done);
    });

    test('it should return 401 if not authenticated', (done) => {
        request(app)
            .get('/users/me')
            .expect(401)
            .expect((res) => {
                expect(res.body).toEqual({});
            })
            .end(done);
    });
});

describe('POST /users', () => {
    test('it should create a user', (done) => {
        const email = 'example@example.com';
        const password = '123ssdf';

        request(app)
            .post('/users')
            .send({email, password})
            .expect(200)
            .expect((res) => {
                expect(res.headers['x-auth']).toBeDefined();
                expect(res.body._id).toBeDefined();
                expect(res.body.email).toBe(email);
            })
            .end((err) => {
                if(err) done(err);

                User.findOne({email}).then((user) => {
                    expect(user).toBeDefined();
                    expect(user.password).not.toBe(password);
                    done();
                });
            });
    });

    test('it should return validation errors if request invalid', (done) => {
        request(app)
            .post('/users')
            .send({email: 'and', password: '123'})
            .expect(400)
            .end(done);
    });

    test('it should not create user if email in use', (done) => {
        request(app)
            .post('/users')
            .send({email: users[0].email, password: 'mypass'})
            .expect(400)
            .end(done);
    });
});

describe('POST /users/login', () => {
    test('it should login and return auth token', (done) => {
        request(app)
            .post('/users/login')
            .send({
                email: users[1].email,
                password: users[1].password
            })
            .expect(200)
            .expect((res) => {
                expect(res.headers['x-auth']).toBeDefined();
            })
            .end((err, res) => {
                if(err) return done(err);

                User.findById(users[1]._id).then((user) => {
                    expect(user.tokens[0]).toEqual(expect.objectContaining({
                        access: 'auth',
                        token: res.headers['x-auth']
                    }));
                    done();
                });
            });
    });

    test('it should reject invalid login', (done) => {
        request(app)
            .post('/users/login')
            .send({
                email: users[1].email,
                password: users[1].password + 'kdsfj'
            })
            .expect(400)
            .expect((res) => {
                expect(res.headers['x-auth']).not.toBeDefined();
            })
            .end((err, res) => {
                if (err) return done(err);

                User.findById(users[1]._id).then((user) => {
                    expect(user.tokens.length).toBe(0);
                    done();
                });
            });
    });
})
