/**
 * @deprecated Import from `@/actions/publishProfiles` instead.
 * Thin aliases kept so older imports keep working during the rename.
 */
export {
  createPublishProfileQuick as createBusinessQuick,
  createPublishProfile as createBusiness,
  updatePublishProfile as updateBusiness,
  deletePublishProfile as deleteBusiness,
  getPublishProfiles as getBusinesses,
  getPublishProfileOptions as getBusinessOptions,
  getPublishProfileByRoomName as getBusinessByRoomName,
  setHomeFeaturedRoom,
  getHomePrimaryAgentRoomName,
  getHomePreviewData,
  getMessageRoomsData,
  type HomePreviewData,
  type MessageRoomData,
} from './publishProfiles'
