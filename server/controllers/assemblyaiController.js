const axios = require('axios');

/**
 * AssemblyAI Controller.
 * Generates temporary streaming tokens for browser-based real-time STT.
 */

/**
 * @desc    Generate a temporary AssemblyAI streaming token
 * @route   GET /api/assemblyai/token
 * @access  Private
 */
const getStreamingToken = async (req, res, next) => {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      console.warn('[AssemblyAI] ASSEMBLYAI_API_KEY is not configured.');
      return res.status(503).json({
        success: false,
        error: 'AssemblyAI is not configured. Speech-to-text will use browser fallback.',
      });
    }

    // Request a temporary token from AssemblyAI Streaming v3
    // Token is single-use and expires after the specified duration
    const response = await axios.get(
      'https://streaming.assemblyai.com/v3/token',
      {
        params: {
          expires_in_seconds: 300, // 5 minutes
        },
        headers: {
          Authorization: apiKey, // AssemblyAI uses raw key, NOT Bearer
        },
        timeout: 10000, // 10s timeout
      }
    );

    console.log('[AssemblyAI] Temporary streaming token generated successfully.');

    res.status(200).json({
      success: true,
      data: {
        token: response.data.token,
      },
    });
  } catch (error) {
    // Log the error details for debugging
    if (error.response) {
      console.error(
        '[AssemblyAI] Token request failed:',
        error.response.status,
        error.response.data
      );
    } else if (error.code === 'ECONNABORTED') {
      console.error('[AssemblyAI] Token request timed out.');
    } else {
      console.error('[AssemblyAI] Token request error:', error.message);
    }

    res.status(503).json({
      success: false,
      error: 'Unable to connect to AssemblyAI. Speech-to-text will use browser fallback.',
    });
  }
};

module.exports = {
  getStreamingToken,
};
