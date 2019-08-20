const R = require('ramda');
const request = require('./utils/request');
const scriptData = require('./utils/scriptData');
const appList = require('./utils/appList');

const body = 'f.req=%5B%5B%5B%22qnKhOb%22%2C%22%5B%5Bnull%2C%5B%5B10%2C%5B10%2C50%5D%5D%2Ctrue%2Cnull%2C%5B96%2C27%2C4%2C8%2C57%2C30%2C110%2C79%2C11%2C16%2C49%2C1%2C3%2C9%2C12%2C104%2C55%2C56%2C51%2C10%2C34%2C77%5D%5D%2Cnull%2C%5C%22%token%%5C%22%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D';
const pattern = /(?<="FdrFJe":")(.*\n?)(?=","GWsdKe")/g;

const processAndRecur = (html, opts, savedApps, mappings, fSid) => {
  if (savedApps.length === 0) {
    const match = html.match(pattern);
    if (match.length > 0) fSid = match[0];
  }

  if (R.is(String, html)) {
    html = scriptData.parse(html);
  }

  const apps = appList.extract(mappings.apps, html);
  const token = R.path(mappings.token, html);

  return checkFinished(opts, [...savedApps, ...apps], token, fSid);
};

const checkFinished = (opts, savedApps, nextToken, fSid) => {
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
    'soc-app': '121',
    'soc-platform': '1',
    'soc-device': '1'
  };

  const requestOptions = Object.assign({
    url: 'https://play.google.com/_/PlayStoreUi/data/batchexecute',
    qs: queryString,
    method: 'POST',
    body: body.replace('%token%', nextToken),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  }, opts.requestOptions);

  return request(requestOptions, opts.throttle)
    .then((html) => {
      const input = JSON.parse(html.substring(5));
      const data = JSON.parse(input[0][2]);
      return processAndRecur(data, opts, savedApps, REQUEST_MAPPINGS, fSid);
    });
};

const initialRequest = (opts) => {
  const skipClusterPage = (html) => {
    const match = html.match(/href="\/store\/apps\/collection\/search_collection_more_results_cluster?(.*?)"/);
    if (match) {
      const innerUrl = 'https://play.google.com/' + match[0].split(/"/)[1];
      const options = Object.assign({ url: innerUrl }, opts.requestOptions);
      return request(options, opts.throttle);
    }
    return html;
  };

  const url = `https://play.google.com/store/search?c=apps&q=${opts.term}&hl=${opts.lang}&gl=${opts.country}`;
  const builtUrl = Object.assign({ url }, opts.requestOptions);

  return request(builtUrl, opts.throttle)
    .then(skipClusterPage)
    .then((html) => processAndRecur(html, opts, [], INITIAL_MAPPINGS));
};

const INITIAL_MAPPINGS = {
  apps: ['ds:3', 0, 1, 0, 0, 0],
  token: ['ds:3', 0, 1, 0, 0, 7, 1]
};

const REQUEST_MAPPINGS = {
  apps: [0, 0, 0],
  token: [0, 0, 7, 1]
};

const getPriceGoogleValue = (value) => {
  switch (value.toLowerCase()) {
    case 'free':
      return 1;
    case 'paid':
      return 2;
    case 'all':
    default:
      return 0;
  }
};

const search = (getParseList, opts) => {
  return new Promise(function (resolve, reject) {
    if (!opts || !opts.term) {
      throw Error('Search term missing');
    }

    if (opts.num && opts.num > 250) {
      throw Error("The number of results can't exceed 250");
    }

    opts = {
      term: encodeURIComponent(opts.term),
      lang: opts.lang || 'pt',
      country: opts.country || 'br',
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
};

module.exports = search;
