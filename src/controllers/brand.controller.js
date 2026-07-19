const Brand = require('../models/brand.model');

exports.createBrand = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Brand name is required' } });
    }

    const brand = new Brand({ name });
    await brand.save();

    res.status(201).json({
      id: brand._id,
      name: brand.name
    });
  } catch (error) {
    next(error);
  }
};
