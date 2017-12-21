const mongoose = require('mongoose');

const Todo = mongoose.model('Todo', {
    text: {
        type: String,
        required: true,
        minlength: 1,
        trim: true
    },
    completed: {
        type: Boolean,
        defalt: false
    },
    completedAt: {
        type: Number,
        defalt: null
    }
});

module.exports = { Todo };