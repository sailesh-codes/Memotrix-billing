import api from '../api/client';

/**
 * Downloads a file from an authenticated API endpoint by fetching the binary blob
 * with the Authorization Bearer token attached, then triggering a browser file save.
 * 
 * Safely strips any duplicate '/api' prefix if passed, ensuring requests resolve to '/api/bills/:id/pdf'.
 */
export async function downloadAuthenticatedFile(url, defaultFilename) {
  try {
    // Strip duplicate '/api' prefix if caller accidentally included it
    let cleanPath = url;
    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.substring(4); // Remove leading '/api'
    }

    console.log(`[DOWNLOAD] Initiating authenticated file download for: ${cleanPath} (resolved via Axios baseURL '/api')`);
    const response = await api.get(cleanPath, { responseType: 'blob' });

    // Validate that response is a binary file blob
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream'
    });

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', defaultFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);

    console.log(`[DOWNLOAD] Download completed successfully for: ${defaultFilename}`);
  } catch (err) {
    let statusCode = err.response?.status || 'Network Error';
    let serverErrorMessage = 'Failed to download file. Please check server logs.';

    // Axios responseType: 'blob' wraps error JSON payloads into a Blob
    if (err.response?.data && err.response.data instanceof Blob) {
      try {
        const errorText = await err.response.data.text();
        console.error(`[DOWNLOAD ERROR] HTTP ${statusCode} Raw Response Body:`, errorText);
        const parsed = JSON.parse(errorText);
        if (parsed && parsed.error) {
          serverErrorMessage = parsed.error;
        }
      } catch (e) {
        console.error('[DOWNLOAD ERROR] Could not parse Blob error response text:', e);
      }
    } else if (err.response?.data?.error) {
      serverErrorMessage = err.response.data.error;
    } else if (err.message) {
      serverErrorMessage = err.message;
    }

    console.error(`[DOWNLOAD FAILED] Path: ${url} | HTTP Status: ${statusCode} | Message: ${serverErrorMessage}`);
    
    window.dispatchEvent(new CustomEvent('memotrix_toast', { 
      detail: { message: `Download Failed (HTTP ${statusCode}): ${serverErrorMessage}`, type: 'error' } 
    }));
  }
}

export default downloadAuthenticatedFile;
