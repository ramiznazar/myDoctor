const BlogPost = require('../models/blogPost.model');
const User = require('../models/user.model');

/**
 * Create blog post
 * @param {Object} data - Blog post data
 * @returns {Promise<Object>} Created blog post
 */
const createBlogPost = async (data) => {
  const { title, content, slug, coverImage, tags, isPublished, publishedAt, authorId } = data;

  // Verify author exists
  const author = await User.findById(authorId);
  if (!author) {
    throw new Error('Author not found');
  }

  // Generate slug if not provided
  const generatedSlug = slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Check if slug already exists
  const existing = await BlogPost.findOne({ slug: generatedSlug });
  if (existing) {
    throw new Error('Blog post with this slug already exists');
  }

  const blogPost = await BlogPost.create({
    title,
    content,
    slug: generatedSlug,
    coverImage,
    tags: tags || [],
    isPublished: isPublished || false,
    publishedAt: isPublished && publishedAt ? new Date(publishedAt) : null,
    authorId
  });

  return blogPost;
};

/**
 * Update blog post
 * @param {string} id - Blog post ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated blog post
 */
const updateBlogPost = async (id, data) => {
  const blogPost = await BlogPost.findById(id);
  
  if (!blogPost) {
    throw new Error('Blog post not found');
  }

  // Check slug uniqueness if updating
  if (data.slug) {
    const existing = await BlogPost.findOne({
      _id: { $ne: id },
      slug: data.slug
    });
    if (existing) {
      throw new Error('Blog post with this slug already exists');
    }
  }

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      if (key === 'publishedAt' && data[key]) {
        blogPost[key] = new Date(data[key]);
      } else {
        blogPost[key] = data[key];
      }
    }
  });

  await blogPost.save();

  return blogPost;
};

/**
 * List blog posts with filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Blog posts and pagination info
 */
const listBlogPosts = async (filter = {}) => {
  const {
    authorId,
    isPublished,
    tags,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (authorId) {
    query.authorId = authorId;
  }

  if (isPublished !== undefined) {
    query.isPublished = isPublished === true || isPublished === 'true';
  }

  if (tags) {
    // Handle both array and comma-separated string
    const tagsArray = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(t => t) : []);
    if (tagsArray.length > 0) {
      query.tags = { $in: tagsArray };
    }
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [blogPosts, total] = await Promise.all([
    BlogPost.find(query)
      .populate('authorId', 'fullName email phone profileImage')
      .skip(skip)
      .limit(limit)
      .sort({ publishedAt: -1, createdAt: -1 }),
    BlogPost.countDocuments(query)
  ]);

  return {
    blogPosts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get blog post by ID
 * @param {string} id - Blog post ID
 * @returns {Promise<Object>} Blog post
 */
const getBlogPost = async (id) => {
  const blogPost = await BlogPost.findById(id)
    .populate('authorId', 'fullName email phone profileImage');
  
  if (!blogPost) {
    throw new Error('Blog post not found');
  }

  return blogPost;
};

/**
 * Delete blog post
 * @param {string} id - Blog post ID
 * @returns {Promise<Object>} Success message
 */
const deleteBlogPost = async (id) => {
  const blogPost = await BlogPost.findById(id);
  
  if (!blogPost) {
    throw new Error('Blog post not found');
  }

  await BlogPost.findByIdAndDelete(id);

  return { message: 'Blog post deleted successfully' };
};

module.exports = {
  createBlogPost,
  updateBlogPost,
  listBlogPosts,
  getBlogPost,
  deleteBlogPost
};

