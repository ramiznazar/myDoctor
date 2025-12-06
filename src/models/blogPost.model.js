const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    default: null
  },
  slug: {
    type: String,
    unique: true,
    default: null
  },
  coverImage: {
    type: String,
    default: null
  },
  content: {
    type: String,
    default: null
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  tags: {
    type: [String],
    default: null
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("BlogPost", blogPostSchema);
