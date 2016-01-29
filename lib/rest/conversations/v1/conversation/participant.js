'use strict';

var _ = require('lodash');
var Q = require('q');
var InstanceContext = require('../../../../base/InstanceContext');
var InstanceResource = require('../../../../base/InstanceResource');
var Page = require('../../../../base/Page');
var deserialize = require('../../../../base/deserialize');
var values = require('../../../../base/values');

var ParticipantPage;
var ParticipantList;
var ParticipantInstance;
var ParticipantContext;

/**
 * Initialize the ParticipantPage
 *
 * @param {Version} version - Version that contains the resource
 * @param {Response} response - Response from the API
 * @param {string} conversationSid - The conversation_sid
 *
 * @returns ParticipantPage
 */
function ParticipantPage(version, response, conversationSid) {
  Page.prototype.constructor.call(this, version, response);

  // Path Solution
  this._solution = {
    conversationSid: conversationSid
  };
}

_.extend(ParticipantPage.prototype, Page.prototype);
ParticipantPage.prototype.constructor = ParticipantPage;

/**
 * Build an instance of ParticipantInstance
 *
 * @param {obj} payload - Payload response from the API
 *
 * @returns ParticipantInstance
 */
ParticipantPage.prototype.getInstance = function getInstance(payload) {
  return new ParticipantInstance(
    this._version,
    payload,
    this._solution.conversationSid
  );
};


/**
 * Initialize the ParticipantList
 *
 * @param {Version} version - Version that contains the resource
 * @param {string} conversationSid - The conversation_sid
 *
 * @returns ParticipantList
 */
function ParticipantList(version, conversationSid) {
  function ParticipantListInstance(sid) {
    return ParticipantListInstance.get(sid);
  }

  ParticipantListInstance._version = version;
  // Path Solution
  ParticipantListInstance._solution = {
    conversationSid: conversationSid
  };
  ParticipantListInstance._uri = _.template(
    '/Conversations/<%= conversationSid %>/Participants' // jshint ignore:line
  )(ParticipantListInstance._solution);
  /**
   * Streams ParticipantInstance records from the API.
   * This operation lazily loads records as efficiently as possible until the limit
   * is reached.
   * The results are passed into the callback function, so this operation is memory efficient.
   *
   * @param {Function} opts.callback - A callback function to process records
   * @param {number} [opts.limit] -
   *         Upper limit for the number of records to return.
   *         list() guarantees never to return more than limit.
   *         Default is no limit
   * @param {number} [opts.pageSize=50] -
   *         Number of records to fetch per request,
   *         when not set will use the default value of 50 records.
   *         If no pageSize is defined but a limit is defined,
   *         list() will attempt to read the limit with the most efficient
   *         page size, i.e. min(limit, 1000)
   */
  ParticipantListInstance.each = function each(opts) {
    opts = opts || {};
    if (!(opts && 'callback' in opts)) {
      throw new Error('opts.callback parameter required');
    }

    var currentPage = 1;
    var limits = this._version.readLimits({
      limit: opts.limit,
      pageSize: opts.pageSize
    });

    var deferred = Q.defer();
    function fetchNextPage(fn) {
      var promise = fn();

      promise.then(function(page) {
        if (_.isEmpty(page.instances)) {
          deferred.resolve();
        }

        _.each(page.instances, opts.callback);

        if ((limits.pageLimit && limits.pageLimit <= currentPage)) {
          deferred.resolve();
        } else {
          currentPage++;
          fetchNextPage(_.bind(page.nextPage, page));
        }
      });

      promise.catch(deferred.reject);
    }

    fetchNextPage(_.bind(this.page, this, opts));

    return deferred.promise;
  };

  /**
   * Lists ParticipantInstance records from the API as a list.
   *
   * @param {number} [opts.limit] -
   *         Upper limit for the number of records to return.
   *         list() guarantees never to return more than limit.
   *         Default is no limit
   * @param {number} [opts.pageSize] -
   *         Number of records to fetch per request,
   *         when not set will use the default value of 50 records.
   *         If no page_size is defined but a limit is defined,
   *         list() will attempt to read the limit with the most
   *         efficient page size, i.e. min(limit, 1000)
   *
   * @returns {Array} A list of records
   */
  ParticipantListInstance.list = function list(opts) {
    opts = opts || {};
    var allResources = [];
    opts.callback = function(resource) {
      allResources.push(resource);
    };

    var promise = this.each(opts);
    promise = promise.then(function() {
      return allResources;
    });

    return promise;
  };

  /**
   * Retrieve a single page of ParticipantInstance records from the API.
   * Request is executed immediately
   *
   * @param {string} [opts.pageToken] - PageToken provided by the API
   * @param {number} [opts.pageNumber] -
   *          Page Number, this value is simply for client state
   * @param {number} [opts.pageSize] - Number of records to return, defaults to 50
   *
   * @returns Page of ParticipantInstance
   */
  ParticipantListInstance.page = function page(opts) {
    opts = opts || {};
    var params = values.of({
      'PageToken': opts.pageToken,
      'Page': opts.pageNumber,
      'PageSize': opts.pageSize
    });

    var promise = version.page(
      'GET',
      this._uri,
      { params: params }
    );

    promise = promise.then(function(response) {
      return new ParticipantPage(
        this._version,
        response,
        this._solution.conversationSid
      );
    }.bind(this));

    return promise;
  };

  /**
   * Create a new ParticipantInstance
   *
   * @returns Newly created ParticipantInstance
   */
  ParticipantListInstance.create = function create(opts) {
    if (_.isUndefined(opts)) {
      throw new Error('Required parameters are missing. Please provide: to, from.');  // jshint ignore:line
    }
    if (_.isUndefined(opts.to)) {
      throw new Error('Required parameter "to" missing.');
    }
    if (_.isUndefined(opts.from)) {
      throw new Error('Required parameter "from" missing.');
    }
    var data = values.of({
      'To': opts.to,
      'From': opts.from
    });

    var promise = this._version.create({
      uri: this._uri,
      method: 'POST',
      data: data,
    });

    promise = promise.then(function(payload) {
      return new ParticipantInstance(
        this._version,
        payload,
        this._solution.conversationSid
      );
    }.bind(this));

    return promise;
  };

  /**
   * Constructs a ParticipantContext
   *
   * @param {string} sid - The sid
   *
   * @returns ParticipantContext
   */
  ParticipantListInstance.get = function get(sid) {
    return new ParticipantContext(
      this._version,
      this._solution.conversationSid,
      sid
    );
  };

  return ParticipantListInstance;
}


/**
 * Initialize the ParticipantContext
 *
 * @param {Version} version - Version that contains the resource
 * @param {object} payload - The instance payload
 * @param {sid} conversationSid - The conversation_sid
 * @param {sid} sid - The sid
 *
 * @returns {ParticipantContext}
 */
function ParticipantInstance(version, payload, conversationSid, sid) {
  InstanceResource.prototype.constructor.call(this, version);

  // Marshaled Properties
  this._properties = {
    sid: payload.sid, // jshint ignore:line,
    address: payload.address, // jshint ignore:line,
    status: payload.status, // jshint ignore:line,
    conversationSid: payload.conversation_sid, // jshint ignore:line,
    dateCreated: deserialize.iso8601DateTime(payload.date_created), // jshint ignore:line,
    startTime: deserialize.iso8601DateTime(payload.start_time), // jshint ignore:line,
    endTime: deserialize.iso8601DateTime(payload.end_time), // jshint ignore:line,
    duration: deserialize.integer(payload.duration), // jshint ignore:line,
    accountSid: payload.account_sid, // jshint ignore:line,
    url: payload.url, // jshint ignore:line,
  };

  // Context
  this._context = undefined;
  this._solution = {
    conversationSid: conversationSid,
    sid: sid || this._properties.sid,
  };
}

_.extend(ParticipantInstance.prototype, InstanceResource.prototype);
ParticipantInstance.prototype.constructor = ParticipantInstance;

Object.defineProperty(ParticipantInstance.prototype,
  '_proxy', {
  get: function() {
    if (!this._context) {
      this._context = new ParticipantContext(
        this._version,
        this._solution.conversationSid,
        this._solution.sid
      );
    }

    return this._context;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'sid', {
  get: function() {
    return this._properties.sid;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'address', {
  get: function() {
    return this._properties.address;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'status', {
  get: function() {
    return this._properties.status;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'conversationSid', {
  get: function() {
    return this._properties.conversationSid;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'dateCreated', {
  get: function() {
    return this._properties.dateCreated;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'startTime', {
  get: function() {
    return this._properties.startTime;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'endTime', {
  get: function() {
    return this._properties.endTime;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'duration', {
  get: function() {
    return this._properties.duration;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'accountSid', {
  get: function() {
    return this._properties.accountSid;
  },
});

Object.defineProperty(ParticipantInstance.prototype,
  'url', {
  get: function() {
    return this._properties.url;
  },
});

/**
 * Fetch a ParticipantInstance
 *
 * @returns Fetched ParticipantInstance
 */
ParticipantInstance.prototype.fetch = function fetch() {
  return this._proxy.fetch();
};


/**
 * Initialize the ParticipantContext
 *
 * @param {Version} version - Version that contains the resource
 * @param {sid} conversationSid - The conversation_sid
 * @param {sid} sid - The sid
 *
 * @returns {ParticipantContext}
 */
function ParticipantContext(version, conversationSid, sid) {
  InstanceContext.prototype.constructor.call(this, version);

  // Path Solution
  this._solution = {
    conversationSid: conversationSid,
    sid: sid,
  };
  this._uri = _.template(
    '/Conversations/<%= conversationSid %>/Participants/<%= sid %>' // jshint ignore:line
  )(this._solution);
}

_.extend(ParticipantContext.prototype, InstanceContext.prototype);
ParticipantContext.prototype.constructor = ParticipantContext;

/**
 * Fetch a ParticipantInstance
 *
 * @returns Fetched ParticipantInstance
 */
ParticipantContext.prototype.fetch = function fetch() {
  var params = values.of({});

  var promise = this._version.fetch({
    method: 'GET',
    uri: this._uri,
    params: params,
  });

  promise = promise.then(function(payload) {
    return new ParticipantInstance(
      this._version,
      payload,
      this._solution.conversationSid,
      this._solution.sid
    );
  }.bind(this));

  return promise;
};

module.exports = {
  ParticipantPage: ParticipantPage,
  ParticipantList: ParticipantList,
  ParticipantInstance: ParticipantInstance,
  ParticipantContext: ParticipantContext
};