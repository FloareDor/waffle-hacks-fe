import React, { useState, useEffect } from 'react';
import flashlogo from '@assets/img/flashlogo.svg';
import backend_url from './links';



async function validateYouTubeUrl(url: string): Promise<boolean> {

  async function getAuthToken(): Promise<string> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['jwtToken'], (result) => {
      resolve(result.jwtToken || '');
      });
    });
  }

  const formData = new FormData();
  formData.append('url', url);
  const jwtToken = await getAuthToken();
  try {
    const response = await fetch(`${backend_url}/validate-url`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    },
      body: formData,
    });
  
    if (!response.ok) {
    throw new Error('Network response was not ok');
    }
  
    const data = await response.json();
    alert(data.isBadURL)
    return data.isBadURL;
  } catch (error) {
    console.error('Error validating YouTube URL:', error);
    return false;
  }
}
export { validateYouTubeUrl };

export default function Onboard(): JSX.Element {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdfName, setExistingPdfName] = useState<string | null>(null);
  const [examDate, setExamDate] = useState<string>('');
  const [badUrls, setBadUrls] = useState<string>('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['jwtToken', 'examDate', 'badUrls', 'flashcards'], (result) => {
      if (result.jwtToken) {
        setJwtToken(result.jwtToken);
        if (result.examDate) setExamDate(result.examDate);
        if (result.badUrls) setBadUrls(result.badUrls);
        fetchExistingData(result.jwtToken);
        if (!result.flashcards) {
          fetchAndSaveFlashcards(result.jwtToken);
        }
      }
    });
  }, []);

  useEffect(() => {
    // Load JWT token and existing data when component mounts
    chrome.storage.local.get(['jwtToken', 'examDate', 'badUrls'], (result) => {
      if (result.jwtToken) {
        setJwtToken(result.jwtToken);
        if (result.examDate) setExamDate(result.examDate);
        if (result.badUrls) setBadUrls(result.badUrls);
        fetchExistingData(result.jwtToken);
      }
    });
  }, []);

  const fetchExistingData = async (token: string) => {
    try {
      const response = await fetch(`${backend_url}/get-data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const userData = data.data[0];
          setExistingPdfName(userData.filename || null);
          // Convert the date from DD-MM-YYYY to YYYY-MM-DD for the input field
          if (userData.specified_date) {
            const [day, month, year] = userData.specified_date.split('-');
            const formattedDate = `${year}-${month}-${day}`;
            setExamDate(formattedDate);
            chrome.storage.local.set({ examDate: formattedDate });
          } else {
            setExamDate('');
            chrome.storage.local.remove('examDate');
          }
          const urls = userData.urls ? userData.urls.join(', ') : '';
          setBadUrls(urls);
          chrome.storage.local.set({ badUrls: urls });
        }
      } else {
        console.error('Failed to fetch existing data');
      }
    } catch (error) {
      console.error('Error fetching existing data:', error);
    }
  };

  const fetchAndSaveFlashcards = async (token: string) => {
    setIsLoadingFlashcards(true);
    try {
      const response = await fetch(`${backend_url}/get-qna`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.response) {
          chrome.storage.local.set({ flashcards: data.response }, () => {
            console.log('Flashcards saved locally');
          });
        }
      } else {
        console.error('Failed to fetch flashcards');
      }
    } catch (error) {
      console.error('Error fetching flashcards:', error);
    } finally {
      setIsLoadingFlashcards(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jwtToken) {
      console.error('No JWT token available');
      return;
    }
  
    const formData = new FormData();
    if (pdfFile) {
      formData.append('file', pdfFile);
    }
    const formattedDate = examDate ? new Date(examDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-') : '';
  
    formData.append('date', formattedDate);
    const urlsArray = badUrls.split(',').map(url => url.trim()).filter(url => url !== '');
    formData.append('urls', JSON.stringify({ urls: urlsArray }));
  
    try {
      const response = await fetch(`${backend_url}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        },
        body: formData
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('Data uploaded successfully:', result);
        alert('Settings saved successfully!');
        setExistingPdfName(pdfFile ? pdfFile.name : existingPdfName);
        
        // Save data locally
        chrome.storage.local.set({
          examDate: examDate,
          badUrls: badUrls
        });

        fetchAndSaveFlashcards(jwtToken);
      } else {
        const errorData = await response.json();
        console.error('Failed to upload data:', errorData);
        alert(`Failed to save settings: ${errorData.detail || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error uploading data:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await chrome.storage.local.remove(['jwtToken', 'examDate', 'badUrls', 'flashcards']);
      console.log('Logged out successfully.');
      window.location.reload();
    } catch (error) {
      console.error('Failed to log out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };
 
  return (
    <div className="w-full min-h-screen bg-black text-white p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-black opacity-20"></div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-8 px-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#74ebd5] to-[#ACB6E5] text-transparent bg-clip-text">Set Up FlashFocus</h1>
        </div>
        {isLoadingFlashcards && (
        <p className="mt-4 text-sm text-gray-400">Loading flashcards in the background...</p>
      )}
        <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
          <div>
            <label htmlFor="pdf-upload" className="block text-sm font-medium mb-2 text-gray-300">
              Upload Notes PDF
            </label>
            {existingPdfName ? (
              <div className="flex items-center justify-between bg-zinc-900 border border-gray-700 rounded-md p-3">
                <span className="text-gray-300">{existingPdfName}</span>
                <button
                  type="button"
                  onClick={() => setExistingPdfName(null)}
                  className="text-red-400 hover:text-red-300 transition duration-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <input
                type="file"
                id="pdf-upload"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 bg-zinc-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
              />
            )}
          </div>
          <div>
            <label htmlFor="exam-date" className="block text-sm font-medium mb-2 text-gray-300">
              Exam Date
            </label>
            <input
              type="date"
              id="exam-date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>
          <div>
            <label htmlFor="bad-urls" className="block text-sm font-medium mb-2 text-gray-300">
              Bad URLs (comma-separated)
            </label>
            <textarea
              id="bad-urls"
              value={badUrls}
              onChange={(e) => setBadUrls(e.target.value)}
              placeholder="e.g., instagram.com, facebook.com"
              className="w-full px-3 py-2 bg-zinc-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
              rows={3}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-[#57b0a0] to-[#7e87ab] text-white py-2 px-4 rounded-md hover:from-[#6eead4] hover:to-[#a2aee6] transition duration-300 ease-in-out transform hover:scale-105 font-semibold"
          >
            Save Settings
          </button>
        </form>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`mt-4 text-sm ${isLoggingOut ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'} text-white py-2 px-4 rounded-md transition duration-300`}
        >
          {isLoggingOut ? 'Logging Out...' : 'Log Out'}
        </button>
      </div>
    </div>
  );
}