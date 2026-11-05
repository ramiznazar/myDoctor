const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../src/middleware/validate');
const { createProductValidator } = require('../src/validators/product.validators');

test('product validation keeps blank required numeric fields as field-level errors', () => {
  const req = {
    body: {
      name: '',
      price: '',
      stock: '',
      variants: [{ name: '', price: '', stock: '' }],
    },
    params: {},
    query: {},
  };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };

  validate(createProductValidator)(req, res, () => assert.fail('Validation unexpectedly passed'));

  assert.equal(res.statusCode, 400);
  const fields = res.payload.errors.map((issue) => issue.field);
  assert.deepEqual(fields.sort(), [
    'body.name',
    'body.price',
    'body.stock',
    'body.variants.0.name',
    'body.variants.0.price',
    'body.variants.0.stock',
  ].sort());
});

test('product validation accepts populated numeric strings', () => {
  const result = createProductValidator.safeParse({
    body: {
      name: 'Prodotto di prova',
      price: '12.50',
      stock: '4',
      variants: [{ name: 'Confezione standard', price: '12.50', stock: '4' }],
    },
    params: {},
    query: {},
  });

  assert.equal(result.success, true);
  assert.equal(result.data.body.price, 12.5);
  assert.equal(result.data.body.variants[0].stock, 4);
});

test('product updates retain omitted optional numeric fields as omitted', () => {
  const { updateProductValidator } = require('../src/validators/product.validators');
  const result = updateProductValidator.safeParse({
    body: { description: 'Testo aggiornato' },
    params: { id: 'product-id' },
    query: {},
  });

  assert.equal(result.success, true);
  assert.equal(Object.hasOwn(result.data.body, 'price'), false);
  assert.equal(Object.hasOwn(result.data.body, 'stock'), false);
});
