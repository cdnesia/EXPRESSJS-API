const bipotService = require('../services/bipot.service');
const ApiResponse = require('../utils/ApiResponse');

async function list(req, res, next) {
  try {
    const bipot = await bipotService.getAllBipot();
    ApiResponse.success(res, { data: bipot, message: 'Berhasil mengambil data biaya dan potongan.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
