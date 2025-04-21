// Main React application for Survey Questions Manager

// State management - Context API
const SurveyContext = React.createContext();

// Dark mode functions
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
  
  createSurvey: async (surveyData) => {
    try {
      const response = await axios.post('/api/surveys', surveyData);
      return response.data;
    } catch (error) {
      console.error('Error creating survey:', error);
      throw error;
    }
  },
  
  updateSurvey: async (id, surveyData) => {
    try {
      const response = await axios.put(`/api/surveys/${id}`, surveyData);
      return response.data;
    } catch (error) {
      console.error(`Error updating survey ${id}:`, error);
      throw error;
    }
  },
  
  deleteSurvey: async (id) => {
    try {
      await axios.delete(`/api/surveys/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting survey ${id}:`, error);
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
  
  searchQuestions: async (query) => {
    try {
      const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('Error searching questions:', error);
      throw error;
    }
  }
};

// Components
const QuestionForm = ({ onSubmit, initialData = null }) => {
  const [questionNumber, setQuestionNumber] = React.useState(initialData?.question_number || '');
  const [questionText, setQuestionText] = React.useState(initialData?.text || '');
  const [options, setOptions] = React.useState(initialData?.options || []);
  const [newOption, setNewOption] = React.useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      question_number: questionNumber,
      text: questionText,
      options: options
    });
    
    // Reset form if not editing
    if (!initialData) {
      setQuestionNumber('');
      setQuestionText('');
      setOptions([]);
      setNewOption('');
    }
  };
  
  const addOption = () => {
    if (newOption.trim()) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };
  
  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="question-number" className="form-label">Question Number</label>
        <input 
          type="text" 
          className="form-control" 
          id="question-number" 
          placeholder="Enter question number (2-10 characters)" 
          minLength="2" 
          maxLength="10" 
          required
          value={questionNumber}
          onChange={(e) => setQuestionNumber(e.target.value)}
        />
      </div>
      
      <div className="mb-3">
        <label htmlFor="question" className="form-label">Question</label>
        <input 
          type="text" 
          className="form-control" 
          id="question" 
          placeholder="Enter your question" 
          required
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
        />
      </div>
      
      <div className="mb-3">
        <label htmlFor="option-input" className="form-label">Options</label>
        <div className="input-group">
          <input 
            type="text" 
            className="form-control" 
            id="option-input" 
            placeholder="Enter an option"
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button type="button" className="btn btn-success" onClick={addOption}>+</button>
        </div>
        
        <ul className="list-group mt-2">
          {options.map((option, index) => (
            <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
              {option}
              <button 
                type="button" 
                className="btn btn-sm btn-danger" 
                onClick={() => removeOption(index)}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      </div>
      
      <button type="submit" className="btn btn-primary">
        {initialData ? 'Save Changes' : 'Add Question'}
      </button>
    </form>
  );
};

const QuestionCard = ({ question, onEdit, onDelete }) => {
  return (
    <div className="question-card">
      <div className="question-header">
        <span className="question-number">{question.question_number}</span>
        <div>
          <button 
            type="button" 
            className="btn-icon btn-edit" 
            onClick={() => onEdit(question)}
          >
            ✏️
          </button>
          <button 
            type="button" 
            className="btn-icon btn-delete" 
            onClick={() => onDelete(question.id)}
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="question-text">{question.text}</div>
      
      <div className="question-options">
        {question.options.map((option, index) => (
          <span key={index} className="option-item">{option}</span>
        ))}
      </div>
    </div>
  );
};

const QuestionsList = ({ questions, onEdit, onDelete }) => {
  if (questions.length === 0) {
    return <div className="text-muted text-center mt-3">No questions added yet.</div>;
  }
  
  return (
    <div>
      {questions.map((question, index) => (
        <QuestionCard 
          key={index} 
          question={question} 
          onEdit={onEdit} 
          onDelete={onDelete} 
        />
      ))}
    </div>
  );
};

const SurveyListItem = ({ survey, onLoad, onDelete }) => {
  return (
    <li className="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <strong>ID: {survey.id} - {survey.name}</strong>
        <div className="text-muted small">
          Created: {formatDate(survey.created_at)}
        </div>
      </div>
      <div>
        <button 
          className="btn btn-sm btn-primary me-2"
          onClick={() => onLoad(survey.id)}
        >
          Load
        </button>
        <button 
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (window.confirm(`Are you sure you want to delete "${survey.name}"?`)) {
              onDelete(survey.id);
            }
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );
};

const SurveyList = ({ surveys, onLoad, onDelete }) => {
  if (!surveys || surveys.length === 0) {
    return <div className="text-muted text-center mt-3">No surveys available.</div>;
  }
  
  return (
    <ul className="list-group">
      {surveys.map((survey) => (
        <SurveyListItem 
          key={survey.id} 
          survey={survey} 
          onLoad={onLoad} 
          onDelete={onDelete} 
        />
      ))}
    </ul>
  );
};

const SurveyDisplay = ({ survey }) => {
  if (!survey) {
    return <div className="text-center text-muted">No survey selected</div>;
  }
  
  return (
    <div>
      <h5>{survey.name}</h5>
      <div className="text-muted mb-3">
        <small>Created: {formatDate(survey.created_at)}</small>
        {survey.updated_at && (
          <small className="ms-2">Updated: {formatDate(survey.updated_at)}</small>
        )}
      </div>
      
      {survey.questions.map((question, index) => (
        <div key={index} className="question-card">
          <div className="question-number">{question.question_number}</div>
          <div className="question-text">{question.text}</div>
          <div className="question-options">
            {question.options.map((option, optIndex) => (
              <span key={optIndex} className="option-item">{option}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const SearchForm = ({ onSearch }) => {
  const [query, setQuery] = React.useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="input-group mb-3">
        <input 
          type="text" 
          className="form-control" 
          placeholder="Search for questions or options..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">Search</button>
      </div>
    </form>
  );
};

const SearchResults = ({ results }) => {
  if (!results) {
    return null;
  }
  
  if (results.length === 0) {
    return <div className="alert alert-info">No results found.</div>;
  }
  
  return (
    <div className="search-results">
      <h5>Search Results ({results.length})</h5>
      {results.map((result, index) => (
        <div key={index} className="question-card">
          <div className="d-flex justify-content-between mb-2">
            <span className="question-number">{result.question_number}</span>
            <span className="text-muted">Survey: {result.survey_name}</span>
          </div>
          <div className="question-text">{result.text}</div>
          <div className="question-options">
            {result.options.map((option, optIndex) => (
              <span key={optIndex} className={`option-item ${result.match_type === 'option' && result.matched_option === option ? 'highlight-modified' : ''}`}>
                {option}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Dark Mode Toggle Component
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

// Main App Component
const App = () => {
  const [questions, setQuestions] = React.useState([]);
  const [editingQuestion, setEditingQuestion] = React.useState(null);
  const [surveys, setSurveys] = React.useState([]);
  const [currentSurvey, setCurrentSurvey] = React.useState(null);
  const [survey1, setSurvey1] = React.useState(null);
  const [survey2, setSurvey2] = React.useState(null);
  const [searchResults, setSearchResults] = React.useState(null);
  const [survey1Id, setSurvey1Id] = React.useState('');
  const [survey2Id, setSurvey2Id] = React.useState('');
  const [saveName, setSaveName] = React.useState('');
  
  // Load surveys on initial render
  React.useEffect(() => {
    loadSurveys();
  }, []);
  
  const loadSurveys = async () => {
    try {
      const surveysData = await SurveyService.getAllSurveys();
      setSurveys(surveysData);
    } catch (error) {
      alert('Failed to load surveys. Please try again.');
    }
  };
  
  const handleAddQuestion = (questionData) => {
    // Generate a unique ID for new questions in memory
    const newQuestion = {
      ...questionData,
      id: Date.now().toString()
    };
    
    setQuestions([...questions, newQuestion]);
  };
  
  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
  };
  
  const handleUpdateQuestion = (updatedQuestion) => {
    setQuestions(questions.map(q => 
      q.id === updatedQuestion.id ? updatedQuestion : q
    ));
    setEditingQuestion(null);
  };
  
  const handleDeleteQuestion = (questionId) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      setQuestions(questions.filter(q => q.id !== questionId));
    }
  };
  
  const handleSaveSurvey = async () => {
    if (!saveName.trim()) {
      alert('Please enter a name for the survey.');
      return;
    }
    
    if (questions.length === 0) {
      alert('Please add at least one question to the survey.');
      return;
    }
    
    try {
      const surveyData = {
        name: saveName,
        questions: questions
      };
      
      await SurveyService.createSurvey(surveyData);
      alert('Survey saved successfully!');
      
      // Reset form
      setQuestions([]);
      setSaveName('');
      
      // Reload surveys
      loadSurveys();
    } catch (error) {
      alert('Failed to save survey. Please try again.');
    }
  };
  
  const handleLoadSurvey = async (surveyId) => {
    try {
      const survey = await SurveyService.getSurveyById(surveyId);
      setCurrentSurvey(survey);
      setQuestions(survey.questions);
      setSaveName(survey.name);
    } catch (error) {
      alert('Failed to load survey. Please try again.');
    }
  };
  
  const handleDeleteSurvey = async (surveyId) => {
    try {
      await SurveyService.deleteSurvey(surveyId);
      setSurveys(surveys.filter(s => s.id !== surveyId));
      
      // Reset current survey if it's the one that was deleted
      if (currentSurvey && currentSurvey.id === surveyId) {
        setCurrentSurvey(null);
        setQuestions([]);
        setSaveName('');
      }
      
      alert('Survey deleted successfully!');
    } catch (error) {
      alert('Failed to delete survey. Please try again.');
    }
  };
  
  const handleCompareSurveys = () => {
    if (!survey1Id || !survey2Id) {
      alert('Please select two surveys to compare.');
      return;
    }
    
    // Redirect to the compare page with query parameters
    window.location.href = `/compare?survey1_id=${survey1Id}&survey2_id=${survey2Id}`;
  };
  
  const handleSearch = async (query) => {
    try {
      const results = await SurveyService.searchQuestions(query);
      setSearchResults(results);
    } catch (error) {
      alert('Failed to perform search. Please try again.');
    }
  };
  
  return (
    <div className="container my-5">
      <DarkModeToggle />
      <h1 className="text-center mb-4">Survey Questions Manager</h1>
      
      {/* Add/Edit Question Form */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h4 className="card-title">
            {editingQuestion ? 'Edit Question' : 'Add New Question'}
          </h4>
          <QuestionForm 
            onSubmit={editingQuestion ? handleUpdateQuestion : handleAddQuestion}
            initialData={editingQuestion}
          />
          {editingQuestion && (
            <button 
              className="btn btn-secondary mt-2"
              onClick={() => setEditingQuestion(null)}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      
      {/* Questions List */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h4 className="card-title">Existing Questions</h4>
          <QuestionsList 
            questions={questions}
            onEdit={handleEditQuestion}
            onDelete={handleDeleteQuestion}
          />
        </div>
      </div>
      
      {/* Save Survey */}
      <div className="card shadow-sm mb-4">
        <div className="card-body text-center">
          <h4 className="card-title">Save Survey</h4>
          <label htmlFor="save-survey-name" className="form-label">Enter Survey Name:</label>
          <input 
            type="text" 
            id="save-survey-name" 
            className="form-control mb-2" 
            placeholder="Enter survey name" 
            style={{ maxWidth: '300px', margin: '0 auto' }}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
          <button 
            className="btn btn-success"
            onClick={handleSaveSurvey}
          >
            Save the Survey
          </button>
        </div>
      </div>
      
      {/* Save and Download Survey */}
      <div className="card shadow-sm mb-4">
        <div className="card-body text-center">
          <h4 className="card-title">Save and Download Survey</h4>
          <label htmlFor="save-and-download-survey-name" className="form-label">Enter Survey Name:</label>
          <input 
            type="text" 
            id="save-and-download-survey-name" 
            className="form-control mb-2" 
            placeholder="Enter survey name" 
            style={{ maxWidth: '300px', margin: '0 auto' }}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
          <button 
            className="btn btn-primary"
            onClick={() => {
              // First save the survey
              handleSaveSurvey();
              
              // Then create a downloadable version
              const surveyData = {
                name: saveName,
                questions: questions,
                createdAt: new Date().toISOString()
              };
              
              const blob = new Blob([JSON.stringify(surveyData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${saveName.replace(/\s+/g, '_')}_survey.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            Save and Download the Survey
          </button>
        </div>
      </div>
      
      {/* Available Surveys */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h4 className="card-title">Available Surveys</h4>
          <SurveyList 
            surveys={surveys}
            onLoad={handleLoadSurvey}
            onDelete={handleDeleteSurvey}
          />
        </div>
      </div>
      
      {/* Search Form */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h4 className="card-title">Search Questions</h4>
          <SearchForm onSearch={handleSearch} />
          <SearchResults results={searchResults} />
        </div>
      </div>
      
      {/* Compare Surveys */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h4 className="card-title text-center">Compare Two Surveys</h4>
          <div className="row mb-3">
            <div className="col-md-6">
              <label htmlFor="survey1-id" className="form-label">Survey 1 ID</label>
              <input 
                type="number" 
                id="survey1-id" 
                className="form-control" 
                placeholder="Enter Survey ID"
                value={survey1Id}
                onChange={(e) => setSurvey1Id(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label htmlFor="survey2-id" className="form-label">Survey 2 ID</label>
              <input 
                type="number" 
                id="survey2-id" 
                className="form-control" 
                placeholder="Enter Survey ID"
                value={survey2Id}
                onChange={(e) => setSurvey2Id(e.target.value)}
              />
            </div>
          </div>
          <button 
            className="btn btn-primary w-100"
            onClick={handleCompareSurveys}
          >
            Compare Surveys
          </button>
        </div>
      </div>
      
      {/* Side-by-Side Surveys */}
      {/*<div className="row">*/}
      {/*  <div className="col-md-6">*/}
      {/*    <div className="card shadow-sm" style={{ height: '400px', overflowY: 'auto' }}>*/}
      {/*      <div className="card-body">*/}
      {/*        <h4 className="card-title text-center">Survey 1</h4>*/}
      {/*        <SurveyDisplay survey={survey1} />*/}
      {/*      </div>*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*  <div className="col-md-6">*/}
      {/*    <div className="card shadow-sm" style={{ height: '400px', overflowY: 'auto' }}>*/}
      {/*      <div className="card-body">*/}
      {/*        <h4 className="card-title text-center">Survey 2</h4>*/}
      {/*        <SurveyDisplay survey={survey2} />*/}
      {/*      </div>*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</div>*/}
    </div>
  );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
