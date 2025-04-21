# Add at the top of app.py
from dotenv import load_dotenv
load_dotenv()
import os
import logging
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "survey_tracking_secret_key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure database (PostgreSQL)
# Handle potential "postgres://" vs "postgresql://" difference
database_url = os.environ.get("DATABASE_URL")
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the app with the extension
db.init_app(app)

with app.app_context():
    # Import models
    from models import Survey, Question, Option, AuditLog
    db.create_all()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compare')
def compare_page():
    return render_template('compare.html')

# API endpoints
@app.route('/api/surveys', methods=['GET'])
def get_surveys():
    surveys = Survey.query.all()
    return jsonify([{
        'id': survey.id,
        'name': survey.name,
        'created_at': survey.created_at.isoformat(),
        'updated_at': survey.updated_at.isoformat() if survey.updated_at else None
    } for survey in surveys])

@app.route('/api/surveys', methods=['POST'])
def create_survey():
    data = request.json
    survey = Survey(name=data.get('name', 'Unnamed Survey'))
    
    # Add questions
    for q_data in data.get('questions', []):
        question = Question(
            survey=survey,
            question_number=q_data.get('question_number', ''),
            text=q_data.get('text', '')
        )
        
        # Add options
        for opt_text in q_data.get('options', []):
            option = Option(question=question, text=opt_text)
            db.session.add(option)
        
        db.session.add(question)
    
    db.session.add(survey)
    
    # Create audit log
    audit = AuditLog(
        action="CREATE",
        entity_type="Survey",
        details=f"Created survey: {survey.name}"
    )
    db.session.add(audit)
    
    db.session.commit()
    
    return jsonify({
        'id': survey.id,
        'name': survey.name,
        'created_at': survey.created_at.isoformat()
    }), 201

@app.route('/api/surveys/<int:survey_id>', methods=['GET'])
def get_survey(survey_id):
    survey = Survey.query.get_or_404(survey_id)
    
    questions = []
    for question in survey.questions:
        questions.append({
            'id': question.id,
            'question_number': question.question_number,
            'text': question.text,
            'options': [option.text for option in question.options]
        })
    
    return jsonify({
        'id': survey.id,
        'name': survey.name,
        'created_at': survey.created_at.isoformat(),
        'updated_at': survey.updated_at.isoformat() if survey.updated_at else None,
        'questions': questions
    })

@app.route('/api/surveys/<int:survey_id>', methods=['PUT'])
def update_survey(survey_id):
    survey = Survey.query.get_or_404(survey_id)
    data = request.json
    
    if 'name' in data:
        survey.name = data['name']
    
    # Handle updated questions
    if 'questions' in data:
        # Remove all existing questions and options
        for question in survey.questions:
            for option in question.options:
                db.session.delete(option)
            db.session.delete(question)
        
        # Add new questions and options
        for q_data in data['questions']:
            question = Question(
                survey=survey,
                question_number=q_data.get('question_number', ''),
                text=q_data.get('text', '')
            )
            
            for opt_text in q_data.get('options', []):
                option = Option(question=question, text=opt_text)
                db.session.add(option)
            
            db.session.add(question)
    
    # Create audit log
    audit = AuditLog(
        action="UPDATE",
        entity_type="Survey",
        entity_id=survey.id,
        details=f"Updated survey: {survey.name}"
    )
    db.session.add(audit)
    
    db.session.commit()
    
    return jsonify({
        'id': survey.id,
        'name': survey.name,
        'updated_at': survey.updated_at.isoformat()
    })

@app.route('/api/surveys/<int:survey_id>', methods=['DELETE'])
def delete_survey(survey_id):
    survey = Survey.query.get_or_404(survey_id)
    
    # Create audit log before deletion
    audit = AuditLog(
        action="DELETE",
        entity_type="Survey",
        entity_id=survey.id,
        details=f"Deleted survey: {survey.name}"
    )
    db.session.add(audit)
    
    # Delete survey (cascades to questions and options)
    db.session.delete(survey)
    db.session.commit()
    
    return '', 204

@app.route('/api/surveys/compare', methods=['GET'])
def compare_surveys():
    survey1_id = request.args.get('survey1_id', type=int)
    survey2_id = request.args.get('survey2_id', type=int)
    
    if not survey1_id or not survey2_id:
        return jsonify({'error': 'Both survey IDs are required'}), 400
    
    survey1 = Survey.query.get_or_404(survey1_id)
    survey2 = Survey.query.get_or_404(survey2_id)
    
    # Get survey data
    survey1_data = {
        'id': survey1.id,
        'name': survey1.name,
        'created_at': survey1.created_at.isoformat(),
        'updated_at': survey1.updated_at.isoformat() if survey1.updated_at else None,
        'questions': [{
            'question_number': q.question_number,
            'text': q.text,
            'options': [option.text for option in q.options]
        } for q in survey1.questions]
    }
    
    survey2_data = {
        'id': survey2.id,
        'name': survey2.name,
        'created_at': survey2.created_at.isoformat(),
        'updated_at': survey2.updated_at.isoformat() if survey2.updated_at else None,
        'questions': [{
            'question_number': q.question_number,
            'text': q.text,
            'options': [option.text for option in q.options]
        } for q in survey2.questions]
    }
    
    # Create comparison data
    comparison = {
        'survey1': survey1_data,
        'survey2': survey2_data
    }
    
    return jsonify(comparison)

@app.route('/api/search', methods=['GET'])
def search_questions():
    query = request.args.get('q', '')
    use_nlp = request.args.get('use_nlp', 'true').lower() == 'true'
    
    if not query:
        return jsonify({'error': 'Search query is required'}), 400
    
    # Check if NLP search is requested
    if use_nlp:
        try:
            # Import the basic module without the complex dependencies
            import nlp_search
            
            # Use the semantic search function which will automatically 
            # fall back to keyword search if the NLP dependencies aren't available
            results = nlp_search.semantic_search(query)
            
            # Log the search results
            app.logger.info(f"Search for '{query}' found {len(results)} results")
            
            # Add a flag to let the frontend know whether NLP was used
            for result in results:
                if 'similarity' in result:
                    result['nlp_used'] = True
                else:
                    result['nlp_used'] = False
            
            return jsonify(results)
        except Exception as e:
            app.logger.error(f"Error in search module: {str(e)}")
            app.logger.info("Falling back to standard search")
            # Fall back to regular search if the module fails
    
    # Standard keyword search as fallback
    query_pattern = f"%{query}%"
    questions = Question.query.filter(Question.text.ilike(query_pattern)).all()
    options = Option.query.filter(Option.text.ilike(query_pattern)).all()
    
    results = []
    
    # Add question matches
    for question in questions:
        results.append({
            'survey_id': question.survey_id,
            'survey_name': question.survey.name,
            'question_id': question.id,
            'question_number': question.question_number,
            'text': question.text,
            'options': [option.text for option in question.options],
            'match_type': 'question'
        })
    
    # Add option matches
    for option in options:
        results.append({
            'survey_id': option.question.survey_id,
            'survey_name': option.question.survey.name,
            'question_id': option.question_id,
            'question_number': option.question.question_number,
            'text': option.question.text,
            'options': [opt.text for opt in option.question.options],
            'match_type': 'option',
            'matched_option': option.text
        })
    
    app.logger.info(f"Standard search for '{query}' found {len(results)} results")
    return jsonify(results)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
