# models.py

from datetime import datetime
from db import db

class Survey(db.Model):
    __tablename__ = 'survey'
    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    questions = db.relationship(
        'Question',
        backref='survey',
        cascade='all, delete-orphan'
    )

    def __repr__(self):
        return f'<Survey {self.name}>'


class Question(db.Model):
    __tablename__ = 'question'
    id              = db.Column(db.Integer, primary_key=True)
    survey_id       = db.Column(
        db.Integer,
        db.ForeignKey('survey.id', ondelete='CASCADE'),
        nullable=False
    )
    question_number = db.Column(db.String(10), nullable=False)
    text            = db.Column(db.Text, nullable=False)

    options = db.relationship(
        'Option',
        backref='question',
        cascade='all, delete-orphan'
    )

    def __repr__(self):
        return f'<Question {self.question_number}: {self.text[:30]}...>'


class Option(db.Model):
    __tablename__ = 'option'
    id          = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(
        db.Integer,
        db.ForeignKey('question.id', ondelete='CASCADE'),
        nullable=False
    )
    text        = db.Column(db.Text, nullable=False)

    def __repr__(self):
        return f'<Option {self.text[:30]}...>'


class AuditLog(db.Model):
    __tablename__ = 'audit_log'
    id          = db.Column(db.Integer, primary_key=True)
    action      = db.Column(db.String(50), nullable=False)   # CREATE, UPDATE, DELETE
    entity_type = db.Column(db.String(50), nullable=False)   # Survey, Question, etc.
    entity_id   = db.Column(db.Integer)
    details     = db.Column(db.Text)
    timestamp   = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<AuditLog {self.action} {self.entity_type} {self.entity_id}>'
