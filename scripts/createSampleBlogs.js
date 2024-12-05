const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost/auth0-login-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Create a temporary user for the blog posts
const User = require('../models/User');
const Blog = require('../models/Blog');

async function createSampleBlogs() {
    try {
        // Create a sample user first
        const sampleUser = new User({
            _id: new mongoose.Types.ObjectId(),
            name: 'John Doe',
            email: 'john@example.com'
        });
        await sampleUser.save();

        // Sample blog posts
        const blogs = [
            {
                title: 'Getting Started with Node.js and Express',
                content: 'Node.js and Express form a powerful combination for building web applications. This guide explores the basics of setting up a Node.js project with Express.',
                author: sampleUser._id,
                slug: 'getting-started-with-nodejs-and-express',
                featuredImage: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479',
                tags: ['nodejs', 'express', 'javascript'],
                status: 'published'
            },
            {
                title: 'Understanding Authentication with Auth0',
                content: 'Security is crucial for modern web applications. Auth0 provides a comprehensive solution for handling authentication and authorization.',
                author: sampleUser._id,
                slug: 'understanding-authentication-with-auth0',
                featuredImage: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c',
                tags: ['auth0', 'security', 'authentication'],
                status: 'published'
            },
            {
                title: 'Building Responsive UIs with Bootstrap 5',
                content: 'Bootstrap 5 brings powerful tools for creating responsive and modern user interfaces. Learn how to use the grid system and components.',
                author: sampleUser._id,
                slug: 'building-responsive-uis-with-bootstrap-5',
                featuredImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8',
                tags: ['bootstrap', 'css', 'frontend'],
                status: 'published'
            },
            {
                title: 'MongoDB Best Practices',
                content: 'Learn the best practices for using MongoDB in your Node.js applications, including schema design and indexing strategies.',
                author: sampleUser._id,
                slug: 'mongodb-best-practices',
                featuredImage: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d',
                tags: ['mongodb', 'database', 'nodejs'],
                status: 'published'
            },
            {
                title: 'Deploying Node.js Apps',
                content: 'A comprehensive guide to deploying Node.js applications to production, covering server setup and monitoring.',
                author: sampleUser._id,
                slug: 'deploying-nodejs-apps',
                featuredImage: 'https://images.unsplash.com/photo-1551033406-611cf9a28f67',
                tags: ['deployment', 'nodejs', 'devops'],
                status: 'published'
            }
        ];

        // Clear existing blogs
        await Blog.deleteMany({});

        // Insert all blog posts
        await Blog.insertMany(blogs);
        
        console.log('Sample blogs created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error creating sample blogs:', error);
        process.exit(1);
    }
}

createSampleBlogs();
