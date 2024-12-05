const mongoose = require('mongoose');
const Blog = require('../models/Blog');

// Connect to MongoDB
mongoose.connect('mongodb://localhost/auth0-login-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Function to generate slug
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

const sampleBlogs = [
    {
        title: "Getting Started with Node.js and Express",
        content: "Node.js and Express form a powerful combination for building web applications. Learn the basics of setting up a Node.js project with Express.",
        author: {
            sub: "auth0|sample",
            name: "John Developer"
        },
        tags: ["nodejs", "express", "javascript"],
        featuredImage: "https://images.unsplash.com/photo-1627398242454-45a1465c2479"
    },
    {
        title: "Understanding Authentication with Auth0",
        content: "Learn how to implement secure authentication in your web applications using Auth0. Best practices and implementation guide.",
        author: {
            sub: "auth0|sample",
            name: "John Developer"
        },
        tags: ["auth0", "security", "authentication"],
        featuredImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c"
    },
    {
        title: "Building Modern UIs with Bootstrap",
        content: "Create responsive and beautiful user interfaces using Bootstrap. Tips and tricks for modern web design.",
        author: {
            sub: "auth0|sample",
            name: "John Developer"
        },
        tags: ["bootstrap", "css", "frontend"],
        featuredImage: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8"
    }
];

async function createSampleBlogs() {
    try {
        // Clear existing blogs
        await Blog.deleteMany({});
        console.log('Cleared existing blogs');

        // Create new blogs
        for (const blogData of sampleBlogs) {
            const blog = new Blog({
                ...blogData,
                slug: generateSlug(blogData.title)
            });
            await blog.save();
            console.log(`Created blog: ${blog.title}`);
        }

        console.log('Sample blogs created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error creating sample blogs:', error);
        process.exit(1);
    }
}

createSampleBlogs();
