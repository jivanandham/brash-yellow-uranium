const mongoose = require('mongoose');
const Blog = require('../models/Blog');

// Function to generate slug from title
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Sample blog posts data
const sampleBlogs = [
    {
        title: "Getting Started with Node.js and Express",
        content: `Node.js and Express form a powerful combination for building web applications. In this guide, we'll explore the basics of setting up a Node.js project with Express.

First, let's understand what makes Node.js special. It's a runtime that allows you to run JavaScript on the server side. When combined with Express, you get a minimal and flexible web application framework that provides a robust set of features.

Let's dive into the key concepts and best practices for building your first Node.js application.`,
        tags: ['nodejs', 'express', 'javascript', 'web development'],
        featuredImage: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479'
    },
    {
        title: "Understanding Authentication with Auth0",
        content: `Security is crucial for modern web applications. Auth0 provides a comprehensive solution for handling authentication and authorization in your applications.

This post explores how to integrate Auth0 into your application, manage user sessions, and implement role-based access control. We'll also look at best practices for securing your endpoints and managing user data.`,
        tags: ['auth0', 'security', 'authentication', 'web development'],
        featuredImage: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c'
    },
    {
        title: "Building Responsive UIs with Bootstrap 5",
        content: `Bootstrap 5 brings powerful tools for creating responsive and modern user interfaces. In this guide, we'll explore the new features and improvements in Bootstrap 5.

Learn how to use the grid system, components, and utilities to build beautiful and responsive websites. We'll cover practical examples and common patterns used in modern web development.`,
        tags: ['bootstrap', 'css', 'frontend', 'responsive design'],
        featuredImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8'
    },
    {
        title: "MongoDB Best Practices for Node.js Applications",
        content: `MongoDB is a popular choice for Node.js applications. This post covers essential best practices for using MongoDB effectively in your Node.js projects.

We'll discuss schema design, indexing strategies, and performance optimization techniques. Learn how to structure your data and write efficient queries for better application performance.`,
        tags: ['mongodb', 'database', 'nodejs', 'performance'],
        featuredImage: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d'
    },
    {
        title: "Deploying Node.js Applications to Production",
        content: `Taking your Node.js application from development to production requires careful planning and consideration of various factors.

This guide covers essential aspects of deployment, including server setup, environment configuration, monitoring, and scaling strategies. Learn how to ensure your application runs smoothly in production.`,
        tags: ['deployment', 'devops', 'nodejs', 'production'],
        featuredImage: 'https://images.unsplash.com/photo-1551033406-611cf9a28f67'
    }
];

// Connect to MongoDB
mongoose.connect('mongodb://localhost/auth0-login-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Seed the database
async function seedBlogs() {
    try {
        // Clear existing blogs
        await Blog.deleteMany({});
        
        // Add sample blogs
        for (const blog of sampleBlogs) {
            const newBlog = new Blog({
                ...blog,
                slug: generateSlug(blog.title),
                author: {
                    sub: 'default-author',
                    name: 'John Doe'
                }
            });
            await newBlog.save();
            console.log(`Created blog: ${blog.title}`);
        }
        
        console.log('Database seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedBlogs();
