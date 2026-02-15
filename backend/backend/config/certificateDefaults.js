
// /config/certificateDefaults.js

module.exports = {
    collegeName: process.env.COLLEGE_NAME || 'DAV College Jalandhar',
    collegeTagline: process.env.COLLEGE_TAGLINE || 'NAAC Re-Accredited with Grade A | DBT-Star College Status | DST-FIST Supported',
    logoLeft: process.env.LOGO_LEFT_URL || 'https://via.placeholder.com/150?text=Left+Logo',
    logoRight: process.env.LOGO_RIGHT_URL || 'https://via.placeholder.com/150?text=Right+Logo',

    // Signatures
    sig1Name: process.env.SIG1_NAME || 'Dr. Dinesh Arora',
    sig1Title: process.env.SIG1_TITLE || 'Vice President IIC',
    sig1Url: process.env.SIG1_URL || '',

    sig2Name: process.env.SIG2_NAME || 'Dr. Rajeev Puri',
    sig2Title: process.env.SIG2_TITLE || 'Convener IIC',
    sig2Url: process.env.SIG2_URL || '',

    sig3Name: process.env.SIG3_NAME || 'Dr. Manav Aggarwal',
    sig3Title: process.env.SIG3_TITLE || 'Internship Coordinator',
    sig3Url: process.env.SIG3_URL || '',

    sig4Name: process.env.SIG4_NAME || 'Dr. Rajesh Kumar',
    sig4Title: process.env.SIG4_TITLE || 'Principal',
    sig4Url: process.env.SIG4_URL || '',
};
