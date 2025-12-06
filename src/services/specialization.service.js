const Specialization = require('../models/specialization.model');

/**
 * Create specialization
 * @param {Object} data - Specialization data
 * @returns {Promise<Object>} Created specialization
 */
const createSpecialization = async (data) => {
  const { name, slug, description, icon } = data;

  // Check if name already exists
  const existing = await Specialization.findOne({ 
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, 'i') } },
      { slug: slug }
    ]
  });

  if (existing) {
    throw new Error('Specialization with this name or slug already exists');
  }

  // Generate slug if not provided
  const generatedSlug = slug || name.toLowerCase().replace(/\s+/g, '-');

  const specialization = await Specialization.create({
    name,
    slug: generatedSlug,
    description,
    icon
  });

  return specialization;
};

/**
 * Update specialization
 * @param {string} id - Specialization ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated specialization
 */
const updateSpecialization = async (id, data) => {
  const specialization = await Specialization.findById(id);
  
  if (!specialization) {
    throw new Error('Specialization not found');
  }

  // Check for duplicate name/slug if updating
  if (data.name || data.slug) {
    const existing = await Specialization.findOne({
      _id: { $ne: id },
      $or: [
        { name: data.name ? { $regex: new RegExp(`^${data.name}$`, 'i') } : null },
        { slug: data.slug }
      ].filter(Boolean)
    });

    if (existing) {
      throw new Error('Specialization with this name or slug already exists');
    }
  }

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      specialization[key] = data[key];
    }
  });

  await specialization.save();

  return specialization;
};

/**
 * List all specializations
 * @returns {Promise<Array>} List of specializations
 */
const listSpecializations = async () => {
  const specializations = await Specialization.find().sort({ name: 1 });
  return specializations;
};

/**
 * Delete specialization
 * @param {string} id - Specialization ID
 * @returns {Promise<Object>} Success message
 */
const deleteSpecialization = async (id) => {
  const specialization = await Specialization.findById(id);
  
  if (!specialization) {
    throw new Error('Specialization not found');
  }

  await Specialization.findByIdAndDelete(id);

  return { message: 'Specialization deleted successfully' };
};

module.exports = {
  createSpecialization,
  updateSpecialization,
  listSpecializations,
  deleteSpecialization
};

