const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { requiresAuth } = require('express-openid-connect');

// Get all blog posts
router.get('/', async (req, res) => {
    try {
        const blogs = await Blog.find({ status: 'published' })
            .populate('author', 'name email')
            .sort({ createdAt: -1 });
        res.render('blog/index', { 
            blogs,
            user: req.oidc.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Get blog create form
router.get('/create', requiresAuth(), (req, res) => {
    res.render('blog/create', { user: req.oidc.user });
});

// Create new blog post
router.post('/create', requiresAuth(), async (req, res) => {
    try {
        const { title, content, tags } = req.body;
        const blog = new Blog({
            title,
            content,
            author: req.user._id,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : []
        });
        await blog.save();
        res.redirect('/blog');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Get single blog post
router.get('/:slug', async (req, res) => {
    try {
        const blog = await Blog.findOne({ slug: req.params.slug })
            .populate('author', 'name email');
        if (!blog) {
            return res.status(404).send('Blog not found');
        }
        res.render('blog/show', { 
            blog,
            user: req.oidc.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Get edit form
router.get('/:slug/edit', requiresAuth(), async (req, res) => {
    try {
        const blog = await Blog.findOne({ 
            slug: req.params.slug,
            author: req.user._id
        });
        if (!blog) {
            return res.status(404).send('Blog not found');
        }
        res.render('blog/edit', { 
            blog,
            user: req.oidc.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Update blog post
router.post('/:slug/edit', requiresAuth(), async (req, res) => {
    try {
        const { title, content, tags } = req.body;
        const blog = await Blog.findOneAndUpdate(
            { slug: req.params.slug, author: req.user._id },
            { 
                title,
                content,
                tags: tags ? tags.split(',').map(tag => tag.trim()) : []
            },
            { new: true }
        );
        if (!blog) {
            return res.status(404).send('Blog not found');
        }
        res.redirect(`/blog/${blog.slug}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Delete blog post
router.post('/:slug/delete', requiresAuth(), async (req, res) => {
    try {
        const blog = await Blog.findOneAndDelete({
            slug: req.params.slug,
            author: req.user._id
        });
        if (!blog) {
            return res.status(404).send('Blog not found');
        }
        res.redirect('/blog');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
