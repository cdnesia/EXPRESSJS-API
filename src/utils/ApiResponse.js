// Single envelope shape for every response in this API — success and
// error alike always carry exactly { success, message, data }, so a client
// never has to branch on which keys exist depending on the endpoint.
function success(res, { data = null, message = 'Berhasil', statusCode = 200 } = {}) {
  return res.status(statusCode).json({ success: true, message, data });
}

function error(res, { message = 'Terjadi kesalahan', statusCode = 500, data = null } = {}) {
  return res.status(statusCode).json({ success: false, message, data });
}

module.exports = { success, error };
