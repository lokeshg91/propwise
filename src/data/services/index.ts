export { getDashboardData } from './dashboard-service'
export { getNotifications } from './notification-service'
export {
  createProperty,
  createUnit,
  getProperties,
  getProperty,
  getPropertyDetail,
  type PropertyDetail,
  updateProperty,
  updateUnit,
} from './property-service'
export { isServiceError, ServiceError } from './service-error'
export {
  activateLease,
  type AssignableProperty,
  cancelLease,
  createTenant,
  endLease,
  getAssignableUnits,
  getTenantDetail,
  getTenants,
  MAX_DEPOSIT_MULTIPLE,
  type TenantDetail,
  type TenantListItem,
  updateTenant,
} from './tenant-service'
export { getCurrentUser } from './user-service'
