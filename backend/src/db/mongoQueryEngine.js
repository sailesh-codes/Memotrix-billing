/**
 * mongoQueryEngine.js
 * 100% Pure MongoDB Query Engine for Memotrix.
 * Translates and executes queries directly against MongoDB Atlas collections.
 * Completely eliminates SQLite, in-memory SQL databases, and native C++ compilation.
 */

export function parseAndExecuteQuery(db, sql, params = []) {
  if (!db) {
    throw new Error('[MongoDB Engine] Database connection is not ready.');
  }

  const trimmedSql = sql.trim();
  const upper = trimmedSql.toUpperCase();

  if (upper.startsWith('SELECT')) {
    return executeSelect(db, trimmedSql, params);
  } else if (upper.startsWith('INSERT')) {
    return executeInsert(db, trimmedSql, params);
  } else if (upper.startsWith('UPDATE')) {
    return executeUpdate(db, trimmedSql, params);
  } else if (upper.startsWith('DELETE')) {
    return executeDelete(db, trimmedSql, params);
  } else {
    // Fallback/Utility queries like "PRAGMA ...", "SELECT 1"
    if (upper === 'SELECT 1' || upper.startsWith('SELECT 1')) {
      return Promise.resolve([{ '1': 1 }]);
    }
    return Promise.resolve([]);
  }
}

/**
 * Execute INSERT query directly into MongoDB collection
 */
async function executeInsert(db, sql, params) {
  // Regex to extract: INSERT INTO tableName (col1, col2, ...) VALUES (?, ?, ...)
  const match = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!match) {
    throw new Error(`[MongoDB Engine] Could not parse INSERT query: ${sql}`);
  }

  const tableName = match[1].toLowerCase();
  const colNames = match[2].split(',').map(c => c.trim().replace(/[`"']/g, ''));
  const col = db.collection(tableName);

  // Map params to column names
  const doc = {};
  let paramIdx = 0;

  colNames.forEach((colName) => {
    let val = undefined;
    if (paramIdx < params.length) {
      val = params[paramIdx++];
    }
    // Handle booleans, nulls, numbers
    if (val === undefined) val = null;
    doc[colName] = val;
  });

  // Ensure timestamps
  if (!doc.created_at) doc.created_at = new Date().toISOString();
  if (!doc.updated_at) doc.updated_at = new Date().toISOString();

  // If doc.id exists, upsert to avoid duplicate key errors on re-insert
  if (doc.id) {
    const cleanDoc = { ...doc };
    delete cleanDoc._id;
    await col.replaceOne({ id: doc.id }, cleanDoc, { upsert: true });
    return { lastID: doc.id, changes: 1 };
  } else {
    const res = await col.insertOne(doc);
    return { lastID: res.insertedId.toString(), changes: 1 };
  }
}

/**
 * Execute UPDATE query directly on MongoDB collection
 */
async function executeUpdate(db, sql, params) {
  // Regex to extract: UPDATE tableName SET col1 = ?, ... [WHERE ...]
  const match = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i);
  if (!match) {
    throw new Error(`[MongoDB Engine] Could not parse UPDATE query: ${sql}`);
  }

  const tableName = match[1].toLowerCase();
  const setPart = match[2].trim();
  const wherePart = match[3] ? match[3].trim() : null;

  const col = db.collection(tableName);

  // Split SET assignments
  const setClauses = splitCommasRespectingParens(setPart);
  const setFields = {};
  const incFields = {};
  let paramIdx = 0;

  for (const clause of setClauses) {
    const eqIdx = clause.indexOf('=');
    if (eqIdx === -1) continue;
    const colName = clause.substring(0, eqIdx).trim().replace(/[`"']/g, '');
    const expr = clause.substring(eqIdx + 1).trim();

    // Check special expressions:
    if (/CURRENT_TIMESTAMP/i.test(expr)) {
      setFields[colName] = new Date().toISOString();
    } else if (/COALESCE\s*\(\s*\?\s*,\s*([a-zA-Z0-9_]+)\s*\)/i.test(expr)) {
      const val = params[paramIdx++];
      if (val !== null && val !== undefined) {
        setFields[colName] = val;
      }
    } else if (/\+\s*\?/i.test(expr)) {
      // e.g. stock_quantity = stock_quantity + ? OR total_spent = COALESCE(total_spent, 0) + ?
      const delta = parseFloat(params[paramIdx++]) || 0;
      incFields[colName] = delta;
    } else if (expr === '?') {
      setFields[colName] = params[paramIdx++];
    } else if (/^NULL$/i.test(expr)) {
      setFields[colName] = null;
    } else if (/^false$/i.test(expr)) {
      setFields[colName] = false;
    } else if (/^true$/i.test(expr)) {
      setFields[colName] = true;
    } else {
      // String or numeric literal like 'void' or 0
      const cleanLiteral = expr.replace(/^['"]|['"]$/g, '');
      setFields[colName] = cleanLiteral;
    }
  }

  // Parse WHERE clause with remaining params
  const whereParams = params.slice(paramIdx);
  const filter = wherePart ? parseWhereClause(wherePart, whereParams) : {};

  // Build MongoDB update document
  const updateDoc = {};
  if (Object.keys(setFields).length > 0) {
    updateDoc.$set = setFields;
  }
  if (Object.keys(incFields).length > 0) {
    updateDoc.$inc = incFields;
  }

  if (Object.keys(updateDoc).length === 0) {
    return { changes: 0 };
  }

  const res = await col.updateMany(filter, updateDoc);
  return { changes: res.modifiedCount };
}

/**
 * Execute DELETE query directly on MongoDB collection
 */
async function executeDelete(db, sql, params) {
  const match = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+))?$/i);
  if (!match) {
    throw new Error(`[MongoDB Engine] Could not parse DELETE query: ${sql}`);
  }

  const tableName = match[1].toLowerCase();
  const wherePart = match[2] ? match[2].trim() : null;
  const col = db.collection(tableName);

  const filter = wherePart ? parseWhereClause(wherePart, params) : {};
  const res = await col.deleteMany(filter);
  return { changes: res.deletedCount };
}

/**
 * Execute SELECT query directly on MongoDB collection
 */
async function executeSelect(db, sql, params) {
  // Check for simple SELECT 1
  if (/^SELECT\s+1\s*$/i.test(sql)) {
    return [{ '1': 1 }];
  }

  // Check for JOIN queries
  if (/JOIN/i.test(sql)) {
    return executeJoinSelect(db, sql, params);
  }

  // Check for GROUP BY / Aggregation queries
  if (/GROUP\s+BY/i.test(sql)) {
    return executeGroupBySelect(db, sql, params);
  }

  // Parse: SELECT <fields> FROM <table> [WHERE ...] [ORDER BY ...] [LIMIT ...]
  const selectMatch = sql.match(/^SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+([0-9?]+)(?:\s+OFFSET\s+([0-9?]+))?)?$/i);

  if (!selectMatch) {
    // If simple regex failed due to sub-clauses, try more flexible match
    return executeFallbackSelect(db, sql, params);
  }

  const rawFields = selectMatch[1].trim();
  const tableName = selectMatch[2].toLowerCase();
  const wherePart = selectMatch[3] ? selectMatch[3].trim() : null;
  const orderPart = selectMatch[4] ? selectMatch[4].trim() : null;
  let limitPart = selectMatch[5] ? selectMatch[5].trim() : null;
  let offsetPart = selectMatch[6] ? selectMatch[6].trim() : null;

  const col = db.collection(tableName);

  // Consume params for WHERE
  let whereParams = [...params];
  if (limitPart === '?') {
    limitPart = whereParams.pop();
  }
  if (offsetPart === '?') {
    offsetPart = whereParams.pop();
  }

  const filter = wherePart ? parseWhereClause(wherePart, whereParams) : {};

  // Check if aggregate COUNT or SUM without GROUP BY:
  // e.g. SELECT COUNT(*) as total FROM bills WHERE tenant_id = ?
  // e.g. SELECT SUM(grand_total) as total_revenue, COUNT(*) as total_bills FROM bills WHERE payment_status != 'void'
  if (/COUNT\s*\(/i.test(rawFields) || /SUM\s*\(/i.test(rawFields)) {
    return executeSimpleAggregate(col, rawFields, filter);
  }

  // Build Sort
  const sort = {};
  if (orderPart) {
    const sortClauses = orderPart.split(',').map(s => s.trim());
    for (const sc of sortClauses) {
      const parts = sc.split(/\s+/);
      const field = parts[0].replace(/[`"']/g, '').replace(/^[a-zA-Z0-9_]+\./, '');
      const dir = parts[1] && parts[1].toUpperCase() === 'DESC' ? -1 : 1;
      sort[field] = dir;
    }
  }

  // Execute query on MongoDB collection
  let cursor = col.find(filter);
  if (Object.keys(sort).length > 0) {
    cursor = cursor.sort(sort);
  }
  if (offsetPart) {
    cursor = cursor.skip(parseInt(offsetPart, 10));
  }
  if (limitPart) {
    cursor = cursor.limit(parseInt(limitPart, 10));
  }

  const rawDocs = await cursor.toArray();

  // Clean _id and apply projection / aliases
  return projectFields(rawDocs, rawFields);
}

/**
 * Handle simple aggregates (COUNT, SUM) without GROUP BY
 */
async function executeSimpleAggregate(col, fieldsStr, filter) {
  const docs = await col.find(filter).toArray();
  const row = {};

  const clauses = splitCommasRespectingParens(fieldsStr);
  for (const c of clauses) {
    const aliasMatch = c.match(/(?:AS\s+["`]?([a-zA-Z0-9_]+)["`]?|([a-zA-Z0-9_]+))$/i);
    const alias = aliasMatch ? aliasMatch[1] || aliasMatch[2] : 'val';

    if (/COUNT\s*\(\s*\*\s*\)/i.test(c) || /COUNT\s*\(\s*1\s*\)/i.test(c)) {
      row[alias] = docs.length;
    } else {
      const sumMatch = c.match(/SUM\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
      if (sumMatch) {
        const col = sumMatch[1];
        const total = docs.reduce((sum, d) => sum + (parseFloat(d[col]) || 0), 0);
        row[alias] = total;
      } else {
        row[alias] = docs.length;
      }
    }
  }

  return [row];
}

/**
 * Handle GROUP BY aggregation queries in MongoDB
 */
async function executeGroupBySelect(db, sql, params) {
  // 1. SELECT bill_date as "Date", SUM(grand_total) as "Daily Revenue (₹)", COUNT(*) as "Bills Issued" FROM bills WHERE payment_status != 'void' GROUP BY bill_date ORDER BY MAX(created_at) DESC LIMIT 60
  // 2. SELECT payment_method, SUM(amount) as total_amount, COUNT(*) as tx_count FROM bill_payments GROUP BY payment_method
  // 3. SELECT item_name, SUM(quantity) as total_qty, SUM(line_total) as total_revenue FROM bill_items GROUP BY item_name ORDER BY total_qty DESC LIMIT 10
  const match = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+?))?\s+GROUP\s+BY\s+([a-zA-Z0-9_]+)(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+([0-9]+))?$/i);

  if (!match) {
    return [];
  }

  const rawFields = match[1].trim();
  const tableName = match[2].toLowerCase();
  const wherePart = match[3] ? match[3].trim() : null;
  const groupByField = match[4].trim();
  const limit = match[6] ? parseInt(match[6], 10) : null;

  const col = db.collection(tableName);
  const filter = wherePart ? parseWhereClause(wherePart, params) : {};

  const docs = await col.find(filter).toArray();

  // In-memory grouping of documents
  const groups = new Map();
  for (const d of docs) {
    const key = d[groupByField] || 'Unknown';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(d);
  }

  const results = [];
  for (const [key, groupDocs] of groups.entries()) {
    const row = {};
    const clauses = splitCommasRespectingParens(rawFields);

    for (const c of clauses) {
      const aliasMatch = c.match(/(?:AS\s+["`]?([^"`]+)["`]?|([a-zA-Z0-9_]+))$/i);
      const alias = aliasMatch ? (aliasMatch[1] || aliasMatch[2]).trim() : 'val';

      if (c.toLowerCase().startsWith(groupByField.toLowerCase())) {
        row[alias] = key;
      } else if (/COUNT\s*\(\s*\*\s*\)/i.test(c)) {
        row[alias] = groupDocs.length;
      } else {
        const sumMatch = c.match(/SUM\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
        if (sumMatch) {
          const field = sumMatch[1];
          const total = groupDocs.reduce((acc, d) => acc + (parseFloat(d[field]) || 0), 0);
          row[alias] = total;
        } else {
          row[alias] = key;
        }
      }
    }
    results.push(row);
  }

  // Sort by first numeric metric or created_at desc
  results.sort((a, b) => {
    const keys = Object.keys(a);
    const numKey = keys.find(k => typeof a[k] === 'number');
    if (numKey) return b[numKey] - a[numKey];
    return 0;
  });

  return limit ? results.slice(0, limit) : results;
}

/**
 * Handle JOIN queries natively using MongoDB collections
 */
async function executeJoinSelect(db, sql, params) {
  // Query 1: customer_discount_rules r JOIN customers c ON r.customer_id = c.id ORDER BY r.created_at DESC
  if (/customer_discount_rules/i.test(sql) && /customers/i.test(sql)) {
    const rules = await db.collection('customer_discount_rules').find({}).sort({ created_at: -1 }).toArray();
    const customers = await db.collection('customers').find({}).toArray();
    const custMap = new Map(customers.map(c => [c.id, c.name]));
    return rules.map(r => ({
      ...cleanDoc(r),
      customer_name: custMap.get(r.customer_id) || ''
    }));
  }

  // Query 2: inventory_adjustments a JOIN products p ON a.product_id = p.id WHERE a.tenant_id = ? ORDER BY ... LIMIT 200
  if (/inventory_adjustments/i.test(sql) && /products/i.test(sql)) {
    const tenantId = params[0] || 'tenant-memotrix-01';
    const adjustments = await db.collection('inventory_adjustments')
      .find({ tenant_id: tenantId })
      .sort({ adjustment_date: -1, created_at: -1 })
      .limit(200)
      .toArray();

    const prodIds = [...new Set(adjustments.map(a => a.product_id).filter(Boolean))];
    const products = await db.collection('products').find({ id: { $in: prodIds } }).toArray();
    const prodMap = new Map(products.map(p => [p.id, p]));

    return adjustments.map(a => {
      const prod = prodMap.get(a.product_id);
      return {
        ...cleanDoc(a),
        product_name: prod?.name || '',
        sku: prod?.sku || ''
      };
    });
  }

  // Query 3: products p LEFT JOIN categories c ON p.category_id = c.id WHERE (p.sku = ? OR p.id = ?) AND p.is_active = true
  if (/products/i.test(sql) && /categories/i.test(sql)) {
    const [p1, p2] = params;
    const filter = {
      $and: [
        { $or: [{ sku: p1 }, { id: p2 }] },
        { is_active: true }
      ]
    };
    const products = await db.collection('products').find(filter).toArray();
    const catIds = [...new Set(products.map(p => p.category_id).filter(Boolean))];
    const categories = await db.collection('categories').find({ id: { $in: catIds } }).toArray();
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    return products.map(p => ({
      ...cleanDoc(p),
      category_name: catMap.get(p.category_id) || p.category || 'General'
    }));
  }

  return [];
}

/**
 * Flexible fallback parser for SELECT queries with subclauses
 */
async function executeFallbackSelect(db, sql, params) {
  const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
  if (!fromMatch) return [];

  const tableName = fromMatch[1].toLowerCase();
  const col = db.collection(tableName);

  const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/i);
  const filter = whereMatch ? parseWhereClause(whereMatch[1].trim(), params) : {};

  const docs = await col.find(filter).toArray();
  return docs.map(cleanDoc);
}

/**
 * Parse SQL WHERE clause to MongoDB filter object
 */
export function parseWhereClause(whereStr, params = []) {
  let paramIdx = 0;
  const nextParam = () => (paramIdx < params.length ? params[paramIdx++] : null);

  const trimmed = whereStr.trim();

  // Pattern 1: (id = ? OR bill_number = ?) AND tenant_id = ?
  if (/\(id\s*=\s*\?\s*OR\s*bill_number\s*=\s*\?\)\s*AND\s*tenant_id\s*=\s*\?/i.test(trimmed)) {
    const idVal = nextParam();
    const billNumVal = nextParam();
    const tenantVal = nextParam();
    return {
      $and: [
        { $or: [{ id: idVal }, { bill_number: billNumVal }] },
        { tenant_id: tenantVal }
      ]
    };
  }

  // Pattern 2: (name LIKE ? OR sku LIKE ? OR category LIKE ?) AND is_active = true
  if (/LIKE/i.test(trimmed) && /is_active\s*=\s*true/i.test(trimmed)) {
    const p1 = nextParam();
    const p2 = nextParam();
    const p3 = nextParam();
    const cleanReg = (s) => (s ? new RegExp(s.replace(/%/g, ''), 'i') : /.*/);
    return {
      $and: [
        {
          $or: [
            { name: { $regex: cleanReg(p1) } },
            { sku: { $regex: cleanReg(p2) } },
            { category: { $regex: cleanReg(p3) } }
          ]
        },
        { is_active: true }
      ]
    };
  }

  // Pattern 3: (p.sku = ? OR p.id = ?) AND p.is_active = true
  if (/\(p\.sku\s*=\s*\?\s*OR\s*p\.id\s*=\s*\?\)\s*AND\s*p\.is_active\s*=\s*true/i.test(trimmed)) {
    const p1 = nextParam();
    const p2 = nextParam();
    return {
      $and: [
        { $or: [{ sku: p1 }, { id: p2 }] },
        { is_active: true }
      ]
    };
  }

  // Pattern 4: (sku = ? OR (LOWER(name) = LOWER(?) AND tenant_id = ?))
  if (/sku\s*=\s*\?\s*OR\s*\(LOWER\(name\)\s*=\s*LOWER\(\?\)\s*AND\s*tenant_id\s*=\s*\?\)/i.test(trimmed)) {
    const sku = nextParam();
    const name = nextParam();
    const tenantId = nextParam();
    return {
      $or: [
        { sku },
        {
          $and: [
            { name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } },
            { tenant_id: tenantId }
          ]
        }
      ]
    };
  }

  // Pattern 5: LOWER(name) = LOWER(?) AND tenant_id = ?
  if (/LOWER\(name\)\s*=\s*LOWER\(\?\)\s*AND\s*tenant_id\s*=\s*\?/i.test(trimmed)) {
    const name = nextParam();
    const tenantId = nextParam();
    return {
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      tenant_id: tenantId
    };
  }

  // Pattern 6: LOWER(username) = ? OR LOWER(email) = ? OR (role = 'admin' ...)
  if (/LOWER\(username\)\s*=\s*\?\s*OR\s*LOWER\(email\)\s*=\s*\?/i.test(trimmed)) {
    const u1 = (nextParam() || '').toLowerCase();
    const u2 = (nextParam() || '').toLowerCase();
    const u3 = (nextParam() || '').toLowerCase();
    const isAdminMatch = ['admin', 'teammemotrix', 'teammemotrix@gmail.com', 'user-admin-01'].includes(u3);
    const conditions = [
      { username: { $regex: new RegExp(`^${escapeRegex(u1)}$`, 'i') } },
      { email: { $regex: new RegExp(`^${escapeRegex(u2)}$`, 'i') } }
    ];
    if (isAdminMatch) {
      conditions.push({ role: 'admin' });
      conditions.push({ id: 'user-admin-01' });
    }
    return { $or: conditions };
  }

  // Pattern 7: UPPER(code) = UPPER(?) AND is_active = true
  if (/UPPER\(code\)\s*=\s*UPPER\(\?\)\s*AND\s*is_active\s*=\s*true/i.test(trimmed)) {
    const code = nextParam();
    return {
      code: { $regex: new RegExp(`^${escapeRegex(code)}$`, 'i') },
      is_active: true
    };
  }

  // Pattern 8: bill_id IN (...)
  if (/bill_id\s+IN\s*\(/i.test(trimmed)) {
    return { bill_id: { $in: params } };
  }

  // Pattern 9: Search bills: bill_number LIKE ? OR customer_name LIKE ? ...
  if (/bill_number\s+LIKE/i.test(trimmed)) {
    const p1 = nextParam();
    const p2 = nextParam();
    const p3 = nextParam();
    const p4 = nextParam();
    const cleanReg = (s) => (s ? new RegExp(s.replace(/%/g, ''), 'i') : /.*/);
    return {
      $or: [
        { bill_number: { $regex: cleanReg(p1) } },
        { customer_name: { $regex: cleanReg(p2) } },
        { customer_phone: { $regex: cleanReg(p3) } },
        { customer_email: { $regex: cleanReg(p4) } }
      ]
    };
  }

  // Pattern 10: stock_quantity <= low_stock_threshold AND is_active = true
  if (/stock_quantity\s*<=\s*low_stock_threshold/i.test(trimmed)) {
    return {
      $expr: { $lte: ['$stock_quantity', '$low_stock_threshold'] },
      is_active: true
    };
  }

  // Pattern 11: username = 'superadmin' OR email = 'superadmin@memotrix.com'
  if (/superadmin/i.test(trimmed)) {
    return {
      $or: [
        { username: 'superadmin' },
        { email: 'superadmin@memotrix.com' }
      ]
    };
  }

  // Pattern 12: General AND clauses (e.g. "tenant_id = ? AND user_id = ?", "id = ? AND tenant_id = ?")
  const andParts = trimmed.split(/\s+AND\s+/i);
  const filter = {};

  for (const part of andParts) {
    const pTrim = part.trim().replace(/^\(|\)$/g, '');

    // Check OR within part (e.g. username = ? OR email = ? OR id = ?)
    if (/\s+OR\s+/i.test(pTrim)) {
      const orParts = pTrim.split(/\s+OR\s+/i);
      const orConditions = orParts.map(op => parseSingleCondition(op.trim(), nextParam));
      return { $or: orConditions.filter(Boolean) };
    }

    const cond = parseSingleCondition(pTrim, nextParam);
    if (cond) {
      Object.assign(filter, cond);
    }
  }

  return filter;
}

function parseSingleCondition(condStr, nextParam) {
  // col = ?
  let match = condStr.match(/^([a-zA-Z0-9_]+)\s*=\s*\?$/);
  if (match) {
    const col = match[1];
    const val = nextParam();
    // Allow matching either id or _id when querying by id
    if (col === 'id') {
      return { $or: [{ id: val }, { _id: val }] };
    }
    return { [col]: val };
  }

  // col != 'void'
  match = condStr.match(/^([a-zA-Z0-9_]+)\s*!=\s*['"]?([a-zA-Z0-9_]+)['"]?$/);
  if (match) {
    return { [match[1]]: { $ne: match[2] } };
  }

  // is_active = true / false
  match = condStr.match(/^([a-zA-Z0-9_]+)\s*=\s*(true|false)$/i);
  if (match) {
    return { [match[1]]: match[2].toLowerCase() === 'true' };
  }

  // col <= ?
  match = condStr.match(/^([a-zA-Z0-9_]+)\s*<=\s*\?$/);
  if (match) {
    return { [match[1]]: { $lte: nextParam() } };
  }

  // LOWER(col) = LOWER(?)
  match = condStr.match(/^LOWER\(([a-zA-Z0-9_]+)\)\s*=\s*LOWER\(\?\)$/i);
  if (match) {
    const val = nextParam();
    return { [match[1]]: { $regex: new RegExp(`^${escapeRegex(val)}$`, 'i') } };
  }

  // tenant_id = ?
  match = condStr.match(/^[a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)\s*=\s*\?$/);
  if (match) {
    return { [match[1]]: nextParam() };
  }

  return null;
}

function cleanDoc(doc) {
  if (!doc) return null;
  const c = { ...doc };
  if (c._id && !c.id) {
    c.id = c._id.toString();
  }
  delete c._id;
  return c;
}

function projectFields(docs, rawFields) {
  if (!docs || docs.length === 0) return [];
  const cleaned = docs.map(cleanDoc);

  if (rawFields.trim() === '*' || rawFields.includes('.*')) {
    return cleaned;
  }

  const fieldList = splitCommasRespectingParens(rawFields).map(f => {
    const asMatch = f.match(/^(.*?)\s+AS\s+["`]?([^"`]+)["`]?$/i);
    if (asMatch) {
      return {
        src: asMatch[1].trim().replace(/[`"']/g, '').replace(/^[a-zA-Z0-9_]+\./, ''),
        target: asMatch[2].trim()
      };
    }
    const clean = f.trim().replace(/[`"']/g, '').replace(/^[a-zA-Z0-9_]+\./, '');
    return { src: clean, target: clean };
  });

  return cleaned.map(d => {
    const p = {};
    for (const f of fieldList) {
      p[f.target] = d[f.src] !== undefined ? d[f.src] : null;
    }
    return p;
  });
}

function splitCommasRespectingParens(str) {
  const parts = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
    }
    if (!inQuotes) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function escapeRegex(string) {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  parseAndExecuteQuery,
  parseWhereClause
};
