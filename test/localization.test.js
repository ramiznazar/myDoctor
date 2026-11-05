const test = require('node:test');
const assert = require('node:assert/strict');

const { localizeBlogPost, localizeProduct } = require('../src/utils/localization');

test('localizeBlogPost returns the reviewed title, content and tags for the requested language', () => {
  const post = {
    title: 'Healthy habits',
    content: '<p>Base article</p>',
    tags: ['wellness'],
    i18n: {
      title: new Map([['it', 'Abitudini salutari']]),
      content: new Map([['it', '<p>Articolo in italiano</p>']]),
      tags: new Map([['it', ['benessere']]])
    }
  };

  const localized = localizeBlogPost(post, 'it-IT');

  assert.equal(localized.title, 'Abitudini salutari');
  assert.equal(localized.content, '<p>Articolo in italiano</p>');
  assert.deepEqual(localized.tags, ['benessere']);
});

test('localizeProduct returns local product text, detail prose and variant copy', () => {
  const product = {
    name: 'Pain relief gel',
    description: 'Base description',
    category: 'Care',
    subCategory: 'Topical',
    tags: ['care'],
    medicineDetails: { warnings: 'Keep away from children.' },
    variants: [{ _id: 'variant-a', name: 'Large pack', packageDescription: '100 ml' }],
    i18n: {
      name: new Map([['it', 'Gel antidolorifico']]),
      description: new Map([['it', 'Descrizione italiana']]),
      category: new Map([['it', 'Cura']]),
      subCategory: new Map([['it', 'Topico']]),
      tags: new Map([['it', ['cura']]]),
      details: new Map([['it', {
        medicineDetails: { warnings: 'Tenere lontano dalla portata dei bambini.' },
        variants: [{ _id: 'variant-a', name: 'Confezione grande', packageDescription: '100 ml' }]
      }]])
    }
  };

  const localized = localizeProduct(product, 'it');

  assert.equal(localized.name, 'Gel antidolorifico');
  assert.equal(localized.description, 'Descrizione italiana');
  assert.equal(localized.category, 'Cura');
  assert.deepEqual(localized.tags, ['cura']);
  assert.equal(localized.medicineDetails.warnings, 'Tenere lontano dalla portata dei bambini.');
  assert.equal(localized.variants[0].name, 'Confezione grande');
});
