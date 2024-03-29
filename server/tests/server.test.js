const request = require('supertest');
const expect = require('expect');
const {ObjectID} = require('mongodb');

const {app} = require('../server');
const { Todo } = require('../models/todo');
const {User} = require('../models/user');
const {todos, populateTodos, users, populateUsers} = require('./seed/seed');

beforeEach(populateUsers);
beforeEach(populateTodos);

describe('POST /todos', () => {
    it('it should create a todo', (done) => {
        var text = 'Test todo text';
        
        const response = request(app)
            .post('/todos')
            .set('x-auth', users[0].tokens[0].token)
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

    it('it should not create a todo with invalid body data', (done) => {
        request(app)
            .post('/todos')
            .set('x-auth', users[0].tokens[0].token)            
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
    it('it should get all todos', (done) => {
        request(app)
            .get('/todos')
            .set('x-auth', users[0].tokens[0].token)
            .expect(200)
            .expect((res) => {
                expect(res.body.todos.length).toBe(1);
            })
            .end(done);
    });
});

describe('GET /todos/:id', () => {
    it('it should return a todo doc', (done) => {
        request(app)
            .get(`/todos/${todos[0]._id.toHexString()}`)
            .set('x-auth', users[0].tokens[0].token)            
            .expect(200)
            .expect((res) => {
                expect(res.body.todo.text).toBe(todos[0].text);
            })
            .end(done);
    });

    it('it should not return a todo doc created by other user', (done) => {
        request(app)
            .get(`/todos/${todos[1]._id.toHexString()}`)
            .set('x-auth', users[0].tokens[0].token)
            .expect(404)
            .end(done);
    });

    it('it should return 404 if todo not found', (done) => {
        const hexId = new ObjectID().toHexString();
        request(app)
            .get(`/todos/${hexId}`)
            .set('x-auth', users[0].tokens[0].token)            
            .expect(404)
            .end(done);
    });

    it('it should return 404 for non-object ids', (done) => {
        request(app)
            .get('/todos/123')
            .set('x-auth', users[0].tokens[0].token)            
            .expect(404)
            .end(done);
    });
});

describe('DELETE /todos/:id', () => {
    it('it should remove a todo', (done) => {
        var hexId = todos[1]._id.toHexString();

        request(app)
            .delete(`/todos/${hexId}`)
            .set('x-auth', users[1].tokens[0].token)
            .expect(200)
            .expect((res) => {
                expect(res.body.todo._id).toBe(hexId);
            })
            .end((err, res) => {
                if(err)  return done(err);

                Todo.findById(hexId).then((todo) => {
                    expect(todo).toBeFalsy();
                    done();
                }).catch((e) => done(e));
            });
    });

    it('it should not remove a todo from other user', (done) => {
        var hexId = todos[0]._id.toHexString();

        request(app)
            .delete(`/todos/${hexId}`)
            .set('x-auth', users[1].tokens[0].token)
            .expect(404)
            .end((err, res) => {
                if (err) return done(err);

                Todo.findById(hexId).then((todo) => {
                    expect(todo).toBeTruthy();
                    done();
                }).catch((e) => done(e));
            });
    });

    it('it should return 404 if todo not found', (done) => {
        const hexId = new ObjectID().toHexString();
        request(app)
            .delete(`/todos/${hexId}`)
            .set('x-auth', users[1].tokens[0].token)            
            .expect(404)
            .end(done);
    });

    it('it should return 404 if object id is invalid', (done) => {
        request(app)
            .delete('/todos/123')
            .set('x-auth', users[1].tokens[0].token)            
            .expect(404)
            .end(done);
    });
});

describe('PATCH /todos/:id', () => {
    it('it should update the todo', (done) => {
        const id = todos[0]._id.toHexString();
        const text = 'first note updated';
        request(app)
            .patch(`/todos/${id}`)
            .set('x-auth', users[0].tokens[0].token)                        
            .send({text: text, completed: true})
            .expect(200)
            .expect((res) => {
                const todo = res.body.todo;
                expect(todo.text).toBe(text);
                expect(todo.completed).toBe(true);
                expect(typeof todo.completedAt).toBe('number');
            })
            .end(done);
    });

    it('it should not update the todo created by other user', (done) => {
        const id = todos[0]._id.toHexString();
        const text = 'first note updated';
        request(app)
            .patch(`/todos/${id}`)
            .set('x-auth', users[1].tokens[0].token)
            .send({ text: text, completed: true })
            .expect(404)
            .end(done);
    });

    it('it should clear completedAt when todo is not completed', (done) => {
        const id = todos[1]._id.toHexString();
        request(app)
            .patch(`/todos/${id}`)
            .set('x-auth', users[1].tokens[0].token)            
            .send({text: 'second note updated', completed: false})
            .expect(200)
            .expect((res) => {
                const todo = res.body.todo;
                expect(todo.text).toBe('second note updated');
                expect(todo.completed).toBe(false);
                expect(todo.completedAt).toBeFalsy();
            })
            .end(done);
    });
});

describe('GET /users/me', () => {
    it('it should return user if authenticated', (done) => {
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

    it('it should return 401 if not authenticated', (done) => {
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
    it('it should create a user', (done) => {
        const email = 'example@example.com';
        const password = '123ssdf';

        request(app)
            .post('/users')
            .send({email, password})
            .expect(200)
            .expect((res) => {
                expect(res.headers['x-auth']).toBeTruthy();
                expect(res.body._id).toBeTruthy();
                expect(res.body.email).toBe(email);
            })
            .end((err) => {
                if(err) done(err);

                User.findOne({email}).then((user) => {
                    expect(user).toBeTruthy();
                    expect(user.password).not.toBe(password);
                    done();
                }).catch((e) => done(e));
            });
    });

    it('it should return validation errors if request invalid', (done) => {
        request(app)
            .post('/users')
            .send({email: 'and', password: '123'})
            .expect(400)
            .end(done);
    });

    it('it should not create user if email in use', (done) => {
        request(app)
            .post('/users')
            .send({email: users[0].email, password: 'mypass'})
            .expect(400)
            .end(done);
    });
});

describe('POST /users/login', () => {
    it('it should login and return auth token', (done) => {
        request(app)
            .post('/users/login')
            .send({
                email: users[1].email,
                password: users[1].password
            })
            .expect(200)
            .expect((res) => {
                expect(res.headers['x-auth']).toBeTruthy();
            })
            .end((err, res) => {
                if(err) return done(err);

                User.findById(users[1]._id).then((user) => {
                    expect(user.toObject().tokens[1]).toMatchObject({
                        access: 'auth',
                        token: res.headers['x-auth']
                    });
                    done();
                }).catch((e) => done(e));
            });
    });

    it('it should reject invalid login', (done) => {
        request(app)
            .post('/users/login')
            .send({
                email: users[1].email,
                password: users[1].password + 'kdsfj'
            })
            .expect(400)
            .expect((res) => {
                expect(res.headers['x-auth']).toBeFalsy();
            })
            .end((err, res) => {
                if (err) return done(err);

                User.findById(users[1]._id).then((user) => {
                    expect(user.tokens.length).toBe(1);
                    done();
                }).catch((e) => done(e));
            });
    });
});

describe('DELETE /users/me/token', () => {
    it('it should remove auth token on logout', (done) => {
        request(app)
            .delete('/users/me/token')
            .set('x-auth', users[0].tokens[0].token)
            .expect(200)
            .end((err, res) => {
                if(err) return done(err);

                User.findById(users[0]._id).then((user) => {
                    expect(user.tokens.length).toBe(0);
                    done();
                }).catch((e) => done(e));
            });
    });
});
