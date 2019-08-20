'use strict';

const R = require('ramda');
const gplay = require('../index');
const assert = require('chai').assert;
const { assertValidApp } = require('./common');

describe('Developer method', () => {
  it('should fetch a valid application list for the given developer', () => {
    return gplay.developer({ devId: 'Jam City, Inc.' })
      .then((apps) => {
        assert(apps.length >= 1, 'should return more than one app');
        apps.map((app) => {
          assertValidApp(app);
          assert.equal(app.developer, 'Jam City, Inc.');
        });
      });
  });

  it('should fetch several pages of distinct apps for the developer', () =>
    gplay.developer({ devId: 'Google LLC', num: 100 })
      .then((apps) => {
        assert.equal(apps.length, 100, 'should return as many apps as requested');
        assert.equal(R.uniq(apps).length, 100, 'should return distinct apps');
      }));

  it('should not throw an error if too many apps requested', () =>
    gplay.developer({ devId: 'Google LLC', num: 500 })
      .then((apps) => {
        assert(apps.length >= 20, 'should return as many apps as available');
      }));
});
