// Survey Comparison Page

// Dark mode functions (copied from main.js for consistency)
const isDarkModeEnabled = () => {
  // Check local storage or system preference
  return localStorage.getItem('darkMode') === 'true' || 
         (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && localStorage.getItem('darkMode') !== 'false');
};

const setDarkMode = (enabled) => {
  if (enabled) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('darkMode', 'true');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('darkMode', 'false');
  }
};

// Initialize dark mode on page load
document.addEventListener('DOMContentLoaded', () => {
  setDarkMode(isDarkModeEnabled());
});

// Utility functions
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
};

// API service
const SurveyService = {
  getAllSurveys: async () => {
    try {
      const response = await axios.get('/api/surveys');
      return response.data;
    } catch (error) {
      console.error('Error fetching surveys:', error);
      throw error;
    }
  },
  
  getSurveyById: async (id) => {
    try {
      const response = await axios.get(`/api/surveys/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching survey ${id}:`, error);
      throw error;
    }
  },
  
  compareSurveys: async (survey1Id, survey2Id) => {
    try {
      const response = await axios.get(`/api/surveys/compare?survey1_id=${survey1Id}&survey2_id=${survey2Id}`);
      return response.data;
    } catch (error) {
      console.error('Error comparing surveys:', error);
      throw error;
    }
  },
  
  searchSurveyQuestions: async (surveyId, query, useNLP = true) => {
    try {
      // If query is empty, return all questions from the survey
      if (!query.trim()) {
        const survey = await SurveyService.getSurveyById(surveyId);
        return survey.questions;
      }
      
      // Use the server-side search API with NLP
      const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}&use_nlp=${useNLP}`);
      const searchResults = response.data;
      
      // Filter search results for this specific survey
      const surveyResults = searchResults.filter(result => result.survey_id === surveyId);
      
      // If we got no results from the server or the server search failed, fall back to client-side search
      if (surveyResults.length === 0) {
        console.log('No server-side search results, falling back to client-side search');
        const survey = await SurveyService.getSurveyById(surveyId);
        
        // Client-side fallback search
        const lowerQuery = query.toLowerCase();
        const filteredQuestions = survey.questions.filter(q => 
          q.text.toLowerCase().includes(lowerQuery) || 
          q.question_number.toLowerCase().includes(lowerQuery) ||
          q.options.some(opt => opt.toLowerCase().includes(lowerQuery))
        );
        
        return filteredQuestions;
      }
      
      // Convert search results to question format
      const questionResults = surveyResults.map(result => ({
        id: result.question_id,
        question_number: result.question_number,
        text: result.text,
        options: result.options,
        // If the result has a similarity score, include it for potential highlighting
        similarity: result.similarity
      }));
      
      // Remove duplicates (same question might match multiple times)
      const uniqueQuestions = questionResults.reduce((acc, current) => {
        const isDuplicate = acc.find(item => item.id === current.id);
        if (!isDuplicate) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      return uniqueQuestions;
    } catch (error) {
      console.error('Error searching survey questions:', error);
      // Fall back to client-side search in case of error
      const survey = await SurveyService.getSurveyById(surveyId);
      const lowerQuery = query.toLowerCase();
      return survey.questions.filter(q => 
        q.text.toLowerCase().includes(lowerQuery) || 
        q.question_number.toLowerCase().includes(lowerQuery) ||
        q.options.some(opt => opt.toLowerCase().includes(lowerQuery))
      );
    }
  }
};

// Components
const DarkModeToggle = () => {
  const [darkMode, setDarkMode] = React.useState(isDarkModeEnabled());
  
  React.useEffect(() => {
    // Apply dark mode settings to the document when darkMode state changes
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);
  
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode); // Update React state, which will trigger the useEffect
  };
  
  return (
    <button 
      className="dark-mode-toggle" 
      onClick={toggleDarkMode}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? '☀️' : '🌙'}
    </button>
  );
};

const SurveySelector = ({ surveys, onSelectSurvey, selectedSurveyId }) => {
  return (
    <div className="mb-3">
      <label htmlFor="survey-selector" className="form-label">Select Survey</label>
      <select 
        id="survey-selector" 
        className="form-select"
        value={selectedSurveyId || ''}
        onChange={(e) => onSelectSurvey(e.target.value ? parseInt(e.target.value) : null)}
      >
        <option value="">-- Select a Survey --</option>
        {surveys.map(survey => (
          <option key={survey.id} value={survey.id}>
            {survey.id} - {survey.name}
          </option>
        ))}
      </select>
    </div>
  );
};

const SearchBar = ({ onSearch, placeholder }) => {
  const [query, setQuery] = React.useState('');
  const [useNLP, setUseNLP] = React.useState(true);
  const [nlpAvailable, setNlpAvailable] = React.useState(null); // null = unknown, true/false once checked
  
  // Check once if NLP is available
  React.useEffect(() => {
    // Make a small test query to see if NLP is working
    if (nlpAvailable === null) {
      const checkNlpAvailable = async () => {
        try {
          const response = await axios.get('/api/search?q=test&use_nlp=true');
          const results = response.data;
          // Check if any result has the nlp_used flag
          const hasNlpResults = results.some(result => result.nlp_used === true);
          setNlpAvailable(hasNlpResults);
        } catch (error) {
          console.error('Error checking NLP availability:', error);
          setNlpAvailable(false);
        }
      };
      
      checkNlpAvailable();
    }
  }, [nlpAvailable]);
  
  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(query, useNLP && nlpAvailable);
  };
  
  return (
    <form onSubmit={handleSearch} className="mb-3">
      <div className="input-group mb-2">
        <input 
          type="text" 
          className="form-control"
          placeholder={placeholder || "Search..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">Search</button>
      </div>
      
      {nlpAvailable === false && (
        <div className="alert alert-warning mb-2 py-2">
          <small>
            <strong>Note:</strong> Natural language search is not available. Using keyword search instead.
          </small>
        </div>
      )}
      
      <div className="form-check form-switch">
        <input 
          className="form-check-input" 
          type="checkbox" 
          id="nlp-search-toggle"
          checked={useNLP}
          onChange={() => setUseNLP(!useNLP)}
          disabled={nlpAvailable === false}
        />
        <label className="form-check-label" htmlFor="nlp-search-toggle">
          Use Natural Language Search
          {nlpAvailable === false && (
            <span className="text-muted"> (Unavailable)</span>
          )}
        </label>
        <small className="form-text text-muted d-block">
          {useNLP && nlpAvailable !== false ? 
            "Semantic search finds related concepts even if words don't match exactly" : 
            "Exact keyword matching only"}
        </small>
      </div>
    </form>
  );
};

const QuestionDisplay = ({ question }) => {
  return (
    <div className="question-card">
      <div className="question-number">{question.question_number}</div>
      <div className="question-text">{question.text}</div>
      <div className="question-options">
        {question.options.map((option, optIndex) => (
          <span key={optIndex} className="option-item">{option}</span>
        ))}
      </div>
    </div>
  );
};

const SurveyDisplay = ({ survey, filteredQuestions = null }) => {
  const questionsToDisplay = filteredQuestions || (survey?.questions || []);
  
  if (!survey) {
    return <div className="text-center text-muted">No survey selected</div>;
  }
  
  return (
    <div>
      <h4>{survey.name}</h4>
      <div className="text-muted mb-3">
        <small>Created: {formatDate(survey.created_at)}</small>
        {survey.updated_at && (
          <small className="ms-2">Updated: {formatDate(survey.updated_at)}</small>
        )}
      </div>
      
      {questionsToDisplay.length === 0 ? (
        <div className="text-muted text-center">No questions match your search.</div>
      ) : (
        questionsToDisplay.map((question, index) => (
          <QuestionDisplay key={index} question={question} />
        ))
      )}
    </div>
  );
};

const SurveyComparisonPanel = React.forwardRef(({ surveys }, ref) => {
  const [survey1Id, setSurvey1Id] = React.useState(null);
  const [survey2Id, setSurvey2Id] = React.useState(null);
  const [survey1, setSurvey1] = React.useState(null);
  const [survey2, setSurvey2] = React.useState(null);
  const [filteredQuestions1, setFilteredQuestions1] = React.useState(null);
  const [filteredQuestions2, setFilteredQuestions2] = React.useState(null);
  
  const handleSelectSurvey1 = async (id) => {
    setSurvey1Id(id);
    setFilteredQuestions1(null);
    
    if (id) {
      try {
        const survey = await SurveyService.getSurveyById(id);
        setSurvey1(survey);
      } catch (error) {
        alert('Failed to load survey. Please try again.');
      }
    } else {
      setSurvey1(null);
    }
  };
  
  const handleSelectSurvey2 = async (id) => {
    setSurvey2Id(id);
    setFilteredQuestions2(null);
    
    if (id) {
      try {
        const survey = await SurveyService.getSurveyById(id);
        setSurvey2(survey);
      } catch (error) {
        alert('Failed to load survey. Please try again.');
      }
    } else {
      setSurvey2(null);
    }
  };
  
  // Expose methods to parent component via ref
  React.useImperativeHandle(ref, () => ({
    handleSelectSurvey1,
    handleSelectSurvey2
  }));
  
  const handleSearch1 = async (query, useNLP = true) => {
    if (!survey1Id) return;
    
    try {
      const filteredQuestions = await SurveyService.searchSurveyQuestions(survey1Id, query, useNLP);
      setFilteredQuestions1(filteredQuestions);
    } catch (error) {
      console.error('Error searching questions:', error);
      alert('Failed to search questions. Please try again.');
    }
  };
  
  const handleSearch2 = async (query, useNLP = true) => {
    if (!survey2Id) return;
    
    try {
      const filteredQuestions = await SurveyService.searchSurveyQuestions(survey2Id, query, useNLP);
      setFilteredQuestions2(filteredQuestions);
    } catch (error) {
      console.error('Error searching questions:', error);
      alert('Failed to search questions. Please try again.');
    }
  };
  
  return (
    <div>
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Survey 1</h5>
            </div>
            <div className="card-body">
              <SurveySelector 
                surveys={surveys} 
                onSelectSurvey={handleSelectSurvey1}
                selectedSurveyId={survey1Id}
              />
              {survey1 && (
                <SearchBar 
                  onSearch={handleSearch1}
                  placeholder="Search questions in Survey 1..." 
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Survey 2</h5>
            </div>
            <div className="card-body">
              <SurveySelector 
                surveys={surveys} 
                onSelectSurvey={handleSelectSurvey2}
                selectedSurveyId={survey2Id}
              />
              {survey2 && (
                <SearchBar 
                  onSearch={handleSearch2}
                  placeholder="Search questions in Survey 2..." 
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="row">
        <div className="col-md-6">
          <div className="survey-panel card" style={{ minHeight: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="card-body">
              <SurveyDisplay 
                survey={survey1} 
                filteredQuestions={filteredQuestions1}
              />
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="survey-panel card" style={{ minHeight: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="card-body">
              <SurveyDisplay 
                survey={survey2} 
                filteredQuestions={filteredQuestions2}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const CompareApp = () => {
  const [surveys, setSurveys] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  
  // Extract query params for direct access
  const urlParams = new URLSearchParams(window.location.search);
  const survey1IdParam = urlParams.get('survey1_id');
  const survey2IdParam = urlParams.get('survey2_id');
  
  // Reference to the comparison panel for auto-loading surveys from URL
  const comparisonPanelRef = React.useRef(null);
  
  // Load all surveys on component mount
  React.useEffect(() => {
    const loadSurveys = async () => {
      try {
        setLoading(true);
        const surveysData = await SurveyService.getAllSurveys();
        setSurveys(surveysData);
        setError(null);
      } catch (error) {
        setError('Failed to load surveys. Please try again.');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSurveys();
  }, []);
  
  // Auto-load surveys from URL parameters when surveys are loaded
  React.useEffect(() => {
    if (!loading && surveys.length > 0 && (survey1IdParam || survey2IdParam) && comparisonPanelRef.current) {
      if (survey1IdParam) {
        comparisonPanelRef.current.handleSelectSurvey1(parseInt(survey1IdParam));
      }
      if (survey2IdParam) {
        comparisonPanelRef.current.handleSelectSurvey2(parseInt(survey2IdParam));
      }
    }
  }, [loading, surveys, survey1IdParam, survey2IdParam]);
  
  return (
    <div className="container mt-4 mb-5">
      <DarkModeToggle />
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Survey Comparison</h1>
        <a href="/" className="btn btn-outline-primary">Return to Survey Manager</a>
      </div>
      
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading surveys...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <SurveyComparisonPanel 
          ref={comparisonPanelRef}
          surveys={surveys} 
        />
      )}
    </div>
  );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<CompareApp />);