from datetime import datetime
from app import db

class Survey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    questions = db.relationship('Question', backref='survey', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Survey {self.name}>'

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('survey.id'), nullable=False)
    question_number = db.Column(db.String(10), nullable=False)
    text = db.Column(db.Text, nullable=False)
    
    # Relationships
    options = db.relationship('Option', backref='question', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Question {self.question_number}: {self.text[:30]}...>'

class Option(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    
    def __repr__(self):
        return f'<Option {self.text[:30]}...>'

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(50), nullable=False)  # CREATE, UPDATE, DELETE
    entity_type = db.Column(db.String(50), nullable=False)  # Survey, Question, etc.
    entity_id = db.Column(db.Integer)
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<AuditLog {self.action} {self.entity_type} {self.entity_id}>'
