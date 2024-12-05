const express = require('express');
const router = express.Router();

// Sample blog posts data
const sampleBlogs = [
    {
        title: "Getting Started with Node.js and Express",
        content: `Node.js and Express form a powerful combination for building web applications. In this comprehensive guide, we'll explore the fundamentals of setting up a Node.js project with Express.

We'll cover essential topics including:
- Setting up your development environment
- Creating your first Express server
- Handling routes and middleware
- Working with templates and static files
- Best practices for project structure`,
        author: {
            name: "John Developer",
            sub: "auth0|123"
        },
        slug: "getting-started-with-nodejs-and-express",
        featuredImage: "https://images.unsplash.com/photo-1627398242454-45a1465c2479",
        tags: ["nodejs", "express", "javascript", "web development"],
        createdAt: new Date("2023-09-01")
    },
    {
        title: "Understanding Authentication with Auth0",
        content: `Security is crucial for modern web applications. Auth0 provides a comprehensive solution for handling authentication and authorization in your applications.

Learn how to:
- Set up Auth0 in your application
- Implement secure login and registration
- Manage user sessions
- Handle role-based access control
- Secure your API endpoints`,
        author: {
            name: "Sarah Security",
            sub: "auth0|456"
        },
        slug: "understanding-authentication-with-auth0",
        featuredImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c",
        tags: ["auth0", "security", "authentication", "web development"],
        createdAt: new Date("2023-09-02")
    },
    {
        title: "Building Modern UIs with Bootstrap 5",
        content: `Bootstrap 5 brings powerful tools for creating responsive and modern user interfaces. This guide explores the new features and improvements in Bootstrap 5.

Key topics covered:
- Grid system and layout
- Components and utilities
- Customization options
- Responsive design principles
- Performance optimization`,
        author: {
            name: "Mike Designer",
            sub: "auth0|789"
        },
        slug: "building-modern-uis-with-bootstrap-5",
        featuredImage: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8",
        tags: ["bootstrap", "css", "frontend", "responsive design"],
        createdAt: new Date("2023-09-03")
    }
];

// Get all blog posts
router.get('/', (req, res) => {
    res.render('blog/index', {
        blogs: sampleBlogs,
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

// Get create blog form
router.get('/create', (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.redirect('/login');
    }
    res.render('blog/create', {
        user: req.oidc.user,
        isAuthenticated: true
    });
});

// Get single blog post
router.get('/:slug', (req, res) => {
    const blog = sampleBlogs.find(b => b.slug === req.params.slug);
    
    if (!blog) {
        return res.status(404).send('Blog not found');
    }
    
    res.render('blog/show', {
        blog,
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

module.exports = router;
