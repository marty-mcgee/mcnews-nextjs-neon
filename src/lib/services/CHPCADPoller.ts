// src/lib/services/CHPCADPoller.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

const COUNTY_CODES: Record<string, string> = {
    'Alameda': 'ALAM',
    'Amador': 'AMA',
    'Butte': 'BUTT',
    'Calaveras': 'CALV',
    'Colusa': 'COLU',
    'Contra Costa': 'CC',
    'Del Norte': 'DN',
    'El Dorado': 'ED',
    'Fresno': 'FRE',
    'Glenn': 'GLE',
    'Humboldt': 'HUM',
    'Imperial': 'IMP',
    'Inyo': 'INY',
    'Kern': 'KERN',
    'Kings': 'KING',
    'Lake': 'LAKE',
    'Lassen': 'LASS',
    'Los Angeles': 'LA',
    'Madera': 'MAD',
    'Marin': 'MRN',
    'Mariposa': 'MP',
    'Mendocino': 'MEND',
    'Merced': 'MERC',
    'Modoc': 'MOD',
    'Mono': 'MONO',
    'Monterey': 'MTY',
    'Napa': 'NAPA',
    'Nevada': 'NEV',
    'Orange': 'ORA',
    'Placer': 'PLAC',
    'Plumas': 'PLU',
    'Riverside': 'RIV',
    'Sacramento': 'SAC',
    'San Benito': 'SBT',
    'San Bernardino': 'SBD',
    'San Diego': 'SD',
    'San Francisco': 'SF',
    'San Joaquin': 'SJ',
    'San Luis Obispo': 'SLO',
    'San Mateo': 'SM',
    'Santa Barbara': 'SB',
    'Santa Clara': 'SCL',
    'Santa Cruz': 'SCZ',
    'Shasta': 'SHA',
    'Sierra': 'SIE',
    'Siskiyou': 'SIS',
    'Solano': 'SOL',
    'Sonoma': 'SON',
    'Stanislaus': 'STA',
    'Sutter': 'SUT',
    'Tehama': 'TEH',
    'Trinity': 'TRI',
    'Tulare': 'TUL',
    'Tuolumne': 'TUO',
    'Ventura': 'VEN',
    'Yolo': 'YOLO',
    'Yuba': 'YUBA'
};

export interface CHPIncident {
  sourceId: string;
  incidentType: string;
  location: string;
  city: string;
  county: string;
  logTime: Date;
  details: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  fetchedAt: Date;
}

export class CHPCADPoller {
  private baseUrl = 'https://cad.chp.ca.gov/Traffic.aspx';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async fetchIncidentsForCounty(countyName: string, countyCode: string): Promise<CHPIncident[]> {
    try {
      console.log(`Fetching CHP incidents for ${countyName}...`);
      
      // First, get the initial page to capture VIEWSTATE values
      const initialResponse = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
        },
        timeout: 15000,
      });

      // Extract VIEWSTATE from the initial page
      const $ = cheerio.load(initialResponse.data);
      const viewState = $('#__VIEWSTATE').val() || '';
      const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val() || '';

      // Now make the POST request with the VIEWSTATE
      const postResponse = await axios.post(
        this.baseUrl,
      // @ts-expect-error
        new URLSearchParams({
          '__VIEWSTATE': viewState,
          '__VIEWSTATEGENERATOR': viewStateGenerator,
          'ddlComCenter': countyCode,
          'btnSubmit': 'Submit'
        }),
        {
          headers: {
            'User-Agent': this.userAgent,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': this.baseUrl,
            'Origin': 'https://cad.chp.ca.gov',
            'Connection': 'keep-alive',
          },
          timeout: 15000,
        }
      );

      const incidents = this.parseIncidentsFromHtml(postResponse.data, countyName);
      console.log(`  ✓ Found ${incidents.length} incidents for ${countyName}`);
      return incidents;
    } catch (error) {
      console.error(`Failed to fetch CHP data for ${countyName}:`, error);
      return [];
    }
  }

  private parseIncidentsFromHtml(html: string, countyName: string): CHPIncident[] {
    const $ = cheerio.load(html);
    const incidents: CHPIncident[] = [];

    // Try multiple possible table selectors
    const table = $('#GridView1, #grdIncidents, .incident-table, table:contains("Type")');
    
    if (table.length === 0) {
      console.warn(`Could not find incident table for ${countyName}`);
      return [];
    }

    // Find the tbody or direct rows
    const rows = table.find('tbody tr').length ? table.find('tbody tr') : table.find('tr');
    
    rows.each((rowIndex, row) => {
      // Skip header row (look for th or first row with Type/Location headers)
      const cells = $(row).find('td');
      if (cells.length < 4) return;
      
      // Skip if this looks like a header row
      const firstCellText = $(cells[0]).text().trim().toLowerCase();
      if (firstCellText === 'type' || firstCellText === 'incident type') return;
      
      const incident: CHPIncident = {
        sourceId: `${countyName}_${Date.now()}_${rowIndex}`,
        incidentType: $(cells[0]).text().trim(),
        location: $(cells[1]).text().trim(),
        city: $(cells[2]).text().trim(),
        county: countyName,
        logTime: new Date(),
        details: $(cells[3]).text().trim(),
        latitude: null,
        longitude: null,
        status: 'active',
        fetchedAt: new Date(),
      };
      
      if (incident.incidentType) {
        incidents.push(incident);
      }
    });

    return incidents;
  }

  async pollAllCounties(): Promise<{ total: number; byCounty: Record<string, number> }> {
    console.log(`\n🚦 Starting CHP CAD poll at ${new Date().toISOString()}`);
    
    let allIncidents: CHPIncident[] = [];
    const byCounty: Record<string, number> = {};
    
    // Poll only a subset of counties to avoid rate limiting
    // const priorityCounties = ['Los Angeles', 'Orange', 'San Diego', 'Sacramento', 'San Francisco', 'Alameda'];
    const priorityCounties = ['Mendocino', 'San Francisco', 'Sacramento', 'Alameda'];
    
    for (const countyName of priorityCounties) {
      const countyCode = COUNTY_CODES[countyName];
      if (!countyCode) continue;
      
      const incidents = await this.fetchIncidentsForCounty(countyName, countyCode);
      allIncidents = [...allIncidents, ...incidents];
      byCounty[countyName] = incidents.length;
      
      // Be respectful: add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`✅ CHP CAD poll complete: ${allIncidents.length} total incidents`);
    
    return {
      total: allIncidents.length,
      byCounty,
    };
  }
}
