const ErrorLog = require('../models/ErrorLog');

const errorHandler = async (err, req, res, next) => {
    console.error(err.stack);

    // Log error to database
    try {
        const errorLog = new ErrorLog({
            error: err.message || 'Unknown error',
            stack: err.stack || '',
            url: req.originalUrl || req.url || '',
            userId: req.user ? req.user._id : null,
            timestamp: new Date()
        });
        await errorLog.save();
    } catch (logError) {
        console.warn('Error saving to error log:', logError);
    }

    // Check if headers have already been sent
    if (res.headersSent) {
        return next(err);
    }

    // Handle different types of errors
    if (err.name === 'ValidationError') {
        return res.status(400).render('error', {
            error: 'Invalid input data',
            details: err.message
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).render('error', {
            error: 'Invalid ID format',
            details: err.message
        });
    }

    if (err.code === 11000) {
        return res.status(400).render('error', {
            error: 'Duplicate entry',
            details: 'This record already exists'
        });
    }

    // Default error response
    res.status(err.status || 500).render('error', {
        error: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'Something went wrong',
        details: process.env.NODE_ENV === 'development' 
            ? err.stack 
            : null
    });
};

module.exports = errorHandler;
