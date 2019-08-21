'use strict';

const request = require('./utils/request');
const scriptData = require('./utils/scriptData');
const appList = require('./utils/appList');
const R = require('ramda');

const body = 'f.req=%5B%5B%5B%22qnKhOb%22%2C%22%5B%5Bnull%2C%5B%5B10%2C%5B10%2C50%5D%5D%2Ctrue%2Cnull%2C%5B96%2C27%2C4%2C8%2C57%2C30%2C110%2C79%2C11%2C16%2C49%2C1%2C3%2C9%2C12%2C104%2C55%2C56%2C51%2C10%2C34%2C77%5D%5D%2Cnull%2C%5C%22%token%%5C%22%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D';
const pattern = /(?<="FdrFJe":")(.*\n?)(?=","GWsdKe")/g;

/*
 * Extract navigation tokens for next pages, parse results and call
 * `checkFinished` to repeat the process with next page if necessary.
 */
function processAndRecur (html, opts, savedApps, mappings, fSid) {
  if (!fSid) {
    const match = html.match(pattern);
    if (match.length > 0) {
      fSid = match[0];
    }
  }

  if (R.is(String, html)) {
    html = scriptData.parse(html);
  }

  const apps = appList.extract(mappings.apps, html);
  const token = R.path(mappings.token, html);

  return checkFinished(opts, [...savedApps, ...apps], token, fSid);
}

/*
 * If already have requested results or there are no more pages, return current
 * app list, otherwise request the ajax endpoint of the next page and process
 * the results.
 */
function checkFinished (opts, savedApps, nextToken, fSid) {
  if (savedApps.length >= opts.num || !nextToken) {
    return savedApps.slice(0, opts.num);
  }

  const formattedDate = '20190805.05';

  const queryString = {
    rpcids: 'qnKhOb',
    'f.sid': fSid,
    bl: `boq_playuiserver_${formattedDate}_p0`,
    hl: opts.lang,
    gl: opts.country,
    //authuser: 0,
    'soc-app': '121',
    'soc-platform': '1',
    'soc-device': '1',
    //rt: 'c', //DESCOMENTAR AQUI PARA FICAR IGUAL A PLAYSTORE.
  };

  const requestOptions = Object.assign({
    url: `https://play.google.com/_/PlayStoreUi/data/batchexecute`,
    qs: queryString,
    method: 'POST',
    body: body.replace('%token%', nextToken),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  }, opts.requestOptions);

  const URL = `https://play.google.com/_/PlayStoreUi/data/batchexecute?${qs.stringify(queryString)}`;
  console.log('Parsed url', URL);

  return request(requestOptions, opts.throttle)
    .then((html) => {

      //comentar essa linha caso o rt=c e descomentar as debaixo;
      const input = JSON.parse(html.substring(5));

      /*
      const initialIndex = html.indexOf('[[') - 1;
      const finalIndex = html.indexOf('["di"') - 4;
      const input = html.substring(initialIndex, finalIndex);
      */
      const data = JSON.parse(input[0][2]);
      return processAndRecur(data, opts, savedApps, REQUEST_MAPPINGS, fSid);
    });
}

/*
 * Make the first search request as in the browser and call `checkfinished` to
 * process the next pages.
 */
function initialRequest (opts) {
  // sometimes the first result page is a cluster of subsections,
  // need to skip to the full results page
  function skipClusterPage (html) {
    const match = html.match(/href="\/store\/apps\/collection\/search_collection_more_results_cluster?(.*?)"/);
    if (match) {
      const innerUrl = 'https://play.google.com/' + match[0].split(/"/)[1];
      return request(Object.assign({
        url: innerUrl
      }, opts.requestOptions), opts.throttle);
    }
    return html;
  }

  const url = `https://play.google.com/store/search?c=apps&q=${opts.term}&hl=${opts.lang}&gl=${opts.country}`;
  return request(Object.assign({ url }, opts.requestOptions), opts.throttle)
    .then(skipClusterPage)
    .then((html) => processAndRecur(html, opts, [], INITIAL_MAPPINGS));
}

const INITIAL_MAPPINGS = {
  apps: ['ds:3', 0, 1, 0, 0, 0],
  token: ['ds:3', 0, 1, 0, 0, 7, 1]
};

const REQUEST_MAPPINGS = {
  apps: [0, 0, 0],
  token: [0, 0, 7, 1]
};

function getPriceGoogleValue (value) {
  switch (value.toLowerCase()) {
    case 'free':
      return 1;
    case 'paid':
      return 2;
    case 'all':
    default:
      return 0;
  }
}

function search (getParseList, opts) {
  return new Promise(function (resolve, reject) {
    if (!opts || !opts.term) {
      throw Error('Search term missing');
    }

    if (opts.num && opts.num > 250) {
      throw Error("The number of results can't exceed 250");
    }

    opts = {
      term: encodeURIComponent(opts.term),
      lang: opts.lang || 'en',
      country: opts.country || 'us',
      num: opts.num || 20,
      fullDetail: opts.fullDetail,
      price: opts.price ? getPriceGoogleValue(opts.price) : 0,
      throttle: opts.throttle,
      cache: opts.cache,
      getParseList,
      requestOptions: opts.requestOptions
    };

    initialRequest(opts)
      .then(resolve)
      .catch(reject);
  });
}

module.exports = search;
