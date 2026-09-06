const ruanganService = require('../services/ruangan.service');
const ApiResponse = require('../utils/ApiResponse');

async function list(req, res, next) {
  try {
    const ruangan = await ruanganService.findAll();
    ApiResponse.success(res, { data: ruangan, message: 'Berhasil mengambil data ruangan.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
