# app.py

from dotenv import load_dotenv
load_dotenv()

import os
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

# shared SQLAlchemy object
from db import db

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.DEBUG)

# ─── Flask App setup ─────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "survey_tracking_secret_key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# ─── Database configuration ──────────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "")
# SQLAlchemy wants "postgresql://" not "postgres://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# initialize db with app
db.init_app(app)

# now import your models and create tables
with app.app_context():
    from models import Survey, Question, Option, AuditLog
    db.create_all()

# ─── Routes & API ─────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/compare')
def compare_page():
    return render_template('compare.html')


@app.route('/api/surveys', methods=['GET'])
def get_surveys():
    surveys = Survey.query.all()
    return jsonify([{
        'id': s.id,
        'name': s.name,
        'created_at': s.created_at.isoformat(),
        'updated_at': s.updated_at and s.updated_at.isoformat()
    } for s in surveys])


@app.route('/api/surveys', methods=['POST'])
def create_survey():
    data = request.json or {}
    survey = Survey(name=data.get('name', 'Unnamed Survey'))
    db.session.add(survey)

    for q in data.get('questions', []):
        question = Question(
            survey=survey,
            question_number=q.get('question_number', ''),
            text=q.get('text', '')
        )
        db.session.add(question)
        for opt in q.get('options', []):
            db.session.add(Option(question=question, text=opt))

    db.session.add(AuditLog(
        action="CREATE",
        entity_type="Survey",
        details=f"Created survey {survey.name}"
    ))
    db.session.commit()

    return jsonify({
        'id': survey.id,
        'name': survey.name,
        'created_at': survey.created_at.isoformat()
    }), 201


@app.route('/api/surveys/<int:survey_id>', methods=['GET'])
def get_survey(survey_id):
    survey = Survey.query.get_or_404(survey_id)
    return jsonify({
        'id': survey.id,
        'name': survey.name,
        'created_at': survey.created_at.isoformat(),
        'updated_at': survey.updated_at and survey.updated_at.isoformat(),
        'questions': [{
            'id': q.id,
            'question_number': q.question_number,
            'text': q.text,
            'options': [o.text for o in q.options]
        } for q in survey.questions]
    })


@app.route('/api/surveys/<int:survey_id>', methods=['PUT'])
def update_survey(survey_id):
    data = request.json or {}
    survey = Survey.query.get_or_404(survey_id)

    if 'name' in data:
        survey.name = data['name']

    if 'questions' in data:
        # delete old questions/options
        for q in survey.questions:
            for o in q.options:
                db.session.delete(o)
            db.session.delete(q)

        # add new
        for q in data['questions']:
            question = Question(
                survey=survey,
                question_number=q.get('question_number', ''),
                text=q.get('text', '')
            )
            db.session.add(question)
            for opt in q.get('options', []):
                db.session.add(Option(question=question, text=opt))

    db.session.add(AuditLog(
        action="UPDATE",
        entity_type="Survey",
        entity_id=survey.id,
        details=f"Updated survey {survey.name}"
    ))
    db.session.commit()

    return jsonify({
        'id': survey.id,
        'name': survey.name,
        'updated_at': survey.updated_at.isoformat()
    })


@app.route('/api/surveys/<int:survey_id>', methods=['DELETE'])
def delete_survey(survey_id):
    survey = Survey.query.get_or_404(survey_id)
    db.session.add(AuditLog(
        action="DELETE",
        entity_type="Survey",
        entity_id=survey.id,
        details=f"Deleted survey {survey.name}"
    ))
    db.session.delete(survey)
    db.session.commit()
    return ('', 204)


@app.route('/api/surveys/compare', methods=['GET'])
def compare_surveys():
    s1 = request.args.get('survey1_id', type=int)
    s2 = request.args.get('survey2_id', type=int)
    if not s1 or not s2:
        return jsonify({'error': 'Both IDs required'}), 400

    survey1 = Survey.query.get_or_404(s1)
    survey2 = Survey.query.get_or_404(s2)

    def to_dict(s):
        return {
            'id': s.id,
            'name': s.name,
            'created_at': s.created_at.isoformat(),
            'updated_at': s.updated_at and s.updated_at.isoformat(),
            'questions': [{
                'question_number': q.question_number,
                'text': q.text,
                'options': [o.text for o in q.options]
            } for q in s.questions]
        }

    return jsonify({
        'survey1': to_dict(survey1),
        'survey2': to_dict(survey2)
    })


@app.route('/api/search', methods=['GET'])
def search_questions():
    from nlp_search import semantic_search, keyword_search

    q = request.args.get('q', '')
    use_nlp = request.args.get('use_nlp', 'true').lower() == 'true'
    if not q:
        return jsonify({'error': 'Query required'}), 400

    if use_nlp:
        try:
            results = semantic_search(q)
        except Exception:
            results = keyword_search(q)
    else:
        results = keyword_search(q)

    # flag NLP usage
    for r in results:
        r['nlp_used'] = 'similarity' in r

    return jsonify(results)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
