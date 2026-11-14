/**
 * Boleh diindeks mesin pencari? Hanya bila SILK_ALLOW_INDEXING=1. Versi demo memuat dokter fiktif dan foto
 * ilustrasi yang tidak boleh muncul di hasil pencarian seolah-olah data sungguhan.
 */
export const indexingAllowed = () => process.env.SILK_ALLOW_INDEXING === '1';
