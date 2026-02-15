const dotenv = require('dotenv');

dotenv.config();

const APP_LINK_DOMAIN = process.env.APP_LINK_DOMAIN || 'https://snapora.com';
const PLAY_STORE_URL = process.env.PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.snapora.app';
const APP_PACKAGE_NAME = process.env.APP_PACKAGE_NAME || 'com.snapora.app';

/**
 * Validates the payload for a given link type.
 * @param {string} type - The type of link to generate.
 * @param {object} payload - The data required for the link.
 * @throws {Error} If validation fails.
 */
const validatePayload = (type, payload) => {
    if (!payload && type !== 'shareApp') {
        throw new Error('Payload is required for this link type.');
    }

    switch (type) {
        case 'invitation':
            if (!payload.eventId) throw new Error('eventId is required for invitation links.');
            break;
        case 'resetPassword':
            if (!payload.token) throw new Error('token is required for resetPassword links.');
            break;
        case 'attendance':
            if (!payload.eventId) throw new Error('eventId is required for attendance links.');
            break;
        case 'shareApp':
            // No payload required
            break;
        case 'subAdminInvite':
            if (!payload.eventId) throw new Error('eventId is required for subAdminInvite links.');
            if (!payload.invitedUserId) throw new Error('invitedUserId is required for subAdminInvite links.');
            break;
        default:
            throw new Error(`Invalid link type: ${type}`);
    }
};

/**
 * Generates the deep link path based on type and payload.
 * @param {string} type 
 * @param {object} payload 
 * @returns {string} The path segment of the deep link.
 */
const getDeepLinkPath = (type, payload) => {
    switch (type) {
        case 'invitation':
            return `/invite/${payload.eventId}`;
        case 'resetPassword':
            return `/reset-password/${payload.token}`;
        case 'attendance':
            return `/attendance/${payload.eventId}`;
        case 'shareApp':
            return `/share`;
        case 'subAdminInvite':
            return `/sub-admin-invite/${payload.eventId}/${payload.invitedUserId}`;
        default:
            return '';
    }
};

/**
 * Generates a universal deep link.
 * @param {string} type - The type of link (invitation, resetPassword, attendance, shareApp, subAdminInvite).
 * @param {object} payload - The required data for the link.
 * @returns {string} The generated deep link.
 */
const generateLink = (type, payload) => {
    validatePayload(type, payload);

    const path = getDeepLinkPath(type, payload);
    const baseUrl = `${APP_LINK_DOMAIN}${path}`;

    // Constructing the fallback link structure
    const fallback = `?apn=${APP_PACKAGE_NAME}&link=${encodeURIComponent(baseUrl)}&afl=${encodeURIComponent(PLAY_STORE_URL)}`;

    return `${baseUrl}${fallback}`;
};

module.exports = { generateLink };
