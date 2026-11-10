"use strict";

const config = require("./config");
const { JsonDatabase } = require("./utils/jsonDatabase");

/**
 * The single JSON-database instance used by the whole application.
 *
 * Tests point `SKILLMATE_DATA_DIR` at a temporary folder before requiring the
 * app, so they never touch the development data.
 */
const db = new JsonDatabase(config.dataDir);

module.exports = db;
