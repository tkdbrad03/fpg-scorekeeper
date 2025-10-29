const { google } = require('googleapis');

function getAuth() {
  const base64Creds = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!base64Creds) throw new Error('Google credentials not configured');
  const credentials = JSON.parse(Buffer.from(base64Creds, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date, course, groups } = req.body;

    if (!date || !groups || !Array.isArray(groups)) {
      return res.status(400).json({ error: 'Missing required fields: date, groups' });
    }

    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = '152dK2m3gluxCdBal9GGLs43aDKFBvy5BiHdnKL3gV4o';

    // Step 1: Clear existing pairings (keep header row)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: 'Pairings!A2:F'
    });

    // Step 2: Build rows for all players
    const rows = [];
    
    groups.forEach(group => {
      const { groupNumber, teeTime, players, scorekeepers } = group;
      
      players.forEach((player, index) => {
        // Check if this player is a scorekeeper
        const isScorekeeper = scorekeepers && scorekeepers.includes(player);
        const scorekeeperNote = isScorekeeper ? `SK${scorekeepers.indexOf(player) + 1}` : '';
        
        rows.push([
          date,                    // A: Date
          course || '',            // B: Course
          groupNumber,             // C: Group
          player,                  // D: Player
          teeTime,                 // E: Tee
          scorekeeperNote          // F: Notes
        ]);
      });
    });

    // Step 3: Write all rows at once
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Pairings!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows
      }
    });

    console.log(`✅ Published ${rows.length} player entries for ${groups.length} groups`);

    return res.status(200).json({
      success: true,
      message: 'Pairings published successfully',
      playersPublished: rows.length,
      groupsPublished: groups.length
    });

  } catch (error) {
    console.error('Error publishing pairings:', error);
    return res.status(500).json({ 
      error: 'Failed to publish pairings: ' + error.message 
    });
  }
};
