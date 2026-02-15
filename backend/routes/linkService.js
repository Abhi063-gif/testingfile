const router = require("express").Router();
const { generateLink } = require("../services/linkService");
const catchAsync = require("../utils/catchAsync");

// Route to generate deep links
router.post(
    "/generate-link",
    catchAsync(async (req, res) => {
        const { type, payload } = req.body;

        if (!type) {
            return res.status(400).json({
                success: false,
                message: "Link type is required",
            });
        }

        const link = generateLink(type, payload);

        res.status(200).json({
            success: true,
            link: link,
        });
    })
);

module.exports = router;
