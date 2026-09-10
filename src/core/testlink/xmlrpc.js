
function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeEntities(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// Encoding: JS value -> XML
// ---------------------------------------------------------------------------


function encodeValue(value) {
  if (value === null || value === undefined) {
    return '<value><string></string></value>';
  }
  if (typeof value === 'boolean') {
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? `<value><int>${value}</int></value>`
      : `<value><double>${value}</double></value>`;
  }
  if (Buffer.isBuffer(value)) {
    return `<value><base64>${value.toString('base64')}</base64></value>`;
  }
  if (Array.isArray(value)) {
    return `<value><array><data>${value.map(encodeValue).join('')}</data></array></value>`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${escapeXml(k)}</name>${encodeValue(v)}</member>`)
      .join('');
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><string>${escapeXml(value)}</string></value>`;
}


function buildRequest(method, params = {}) {
  return (
    '<?xml version="1.0"?>' +
    `<methodCall><methodName>${escapeXml(method)}</methodName>` +
    `<params><param>${encodeValue(params)}</param></params></methodCall>`
  );
}

// ---------------------------------------------------------------------------
// Parsing: XML -> tree -> JS value
// ---------------------------------------------------------------------------


function parseXml(xml) {
  const root = { name: '#root', children: [], text: '' };
  const stack = [root];
  let i = 0;

  while (i < xml.length) {
    const lt = xml.indexOf('<', i);

    if (lt === -1) {
      stack[stack.length - 1].text += xml.slice(i);
      break;
    }
    if (lt > i) {
      stack[stack.length - 1].text += xml.slice(i, lt);
    }

    
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt);
      stack[stack.length - 1].text += xml.slice(lt + 9, end === -1 ? xml.length : end);
      i = end === -1 ? xml.length : end + 3;
      continue;
    }
    
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt);
      i = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const end = xml.indexOf('>', lt);
      i = end === -1 ? xml.length : end + 1;
      continue;
    }

    const gt = xml.indexOf('>', lt);
    if (gt === -1) break;

    const raw = xml.slice(lt + 1, gt).trim();

    if (raw.startsWith('/')) {
      if (stack.length > 1) stack.pop();
      i = gt + 1;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const name = raw.replace(/\/$/, '').trim().split(/\s+/)[0];
    const node = { name, children: [], text: '' };

    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
    i = gt + 1;
  }

  return root;
}


function child(node, name) {
  return node.children.find((c) => c.name === name);
}


function descendant(node, name) {
  const queue = [...node.children];
  while (queue.length) {
    const n = queue.shift();
    if (n.name === name) return n;
    queue.push(...n.children);
  }
  return undefined;
}


function decodeValue(valueNode) {
  const typed = valueNode.children[0];
  if (!typed) return decodeEntities(valueNode.text);

  switch (typed.name) {
    case 'string':
      return decodeEntities(typed.text);
    case 'int':
    case 'i4':
      return parseInt(typed.text.trim(), 10);
    case 'double':
      return parseFloat(typed.text.trim());
    case 'boolean':
      return typed.text.trim() === '1';
    case 'base64':
      return Buffer.from(typed.text.trim(), 'base64');
    case 'dateTime.iso8601':
      return typed.text.trim();
    case 'nil':
      return null;

    case 'array': {
      const data = child(typed, 'data');
      if (!data) return [];
      return data.children.filter((c) => c.name === 'value').map(decodeValue);
    }

    case 'struct': {
      const out = {};
      for (const member of typed.children.filter((c) => c.name === 'member')) {
        const nameNode = child(member, 'name');
        const valNode = child(member, 'value');
        if (nameNode) {
          out[decodeEntities(nameNode.text).trim()] = valNode ? decodeValue(valNode) : null;
        }
      }
      return out;
    }

    default:
      return decodeEntities(typed.text);
  }
}


class XmlRpcFault extends Error {
  constructor(code, message) {
    super(`TestLink error ${code}: ${message}`);
    this.name = 'XmlRpcFault';
    this.code = code;
    this.faultString = message;
  }
}


function parseResponse(xml) {
  const trimmed = String(xml).trim();

  // A PHP error page is not XML at all. Say so plainly rather than failing
  // with a confusing parse error twenty lines later.
  if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<methodResponse')) {
    const preview = trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    throw new Error(
      `TestLink did not return XML. The server may be misconfigured.\n  Response was: ${preview}`
    );
  }

  const doc = parseXml(trimmed);
  const response = descendant(doc, 'methodResponse') || doc;

  const fault = child(response, 'fault');
  if (fault) {
    const value = descendant(fault, 'value');
    const decoded = value ? decodeValue(value) : {};
    throw new XmlRpcFault(decoded.faultCode ?? -1, decoded.faultString ?? 'unknown fault');
  }

  const valueNode = descendant(response, 'value');
  if (!valueNode) return null;

  const result = decodeValue(valueNode);
  assertNotInBandError(result);
  return result;
}


function assertNotInBandError(result) {
  const candidate = Array.isArray(result) ? result[0] : result;

  if (
    candidate &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    'code' in candidate &&
    'message' in candidate &&
    Object.keys(candidate).length <= 3
  ) {
    throw new XmlRpcFault(candidate.code, candidate.message);
  }
}

module.exports = { buildRequest, parseResponse, XmlRpcFault };
