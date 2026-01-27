/**
 * Converts user data from database snake_case to frontend camelCase
 * @param {Object} user - User object from database
 * @returns {Object} Formatted user object with camelCase properties
 */
export function formatUserResponse(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    lastName: user.lastName,
    firstName: user.firstName,
    middleName: user.middleName,
    position: user.position,
    role: user.role,
    profilePicture: user.profile_picture,
    mustChangePassword: user.must_change_password === 1,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}
