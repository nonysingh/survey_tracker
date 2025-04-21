import logging
import numpy as np
from models import Survey, Question, Option
from flask import current_app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flag to track if NLP dependencies are available
nlp_available = False

# Try to import NLP dependencies
try:
    from transformers import AutoModel, AutoTokenizer
    import torch
    nlp_available = True
    logger.info("Successfully imported NLP dependencies")
except ImportError:
    logger.warning("NLP dependencies not available. Falling back to basic search.")
    nlp_available = False

# Global variables to store model and tokenizer
model = None
tokenizer = None

def initialize_model():
    """
    Initialize the model and tokenizer for sentence embeddings.
    Uses a small, efficient model from Hugging Face for sentence similarity.
    """
    global model, tokenizer
    
    try:
        logger.info("Initializing NLP model for semantic search...")
        # Use a smaller, efficient model for sentence embeddings
        model_name = "sentence-transformers/all-MiniLM-L6-v2"
        
        # Load tokenizer and model
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModel.from_pretrained(model_name)
        
        logger.info(f"Successfully loaded model: {model_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize NLP model: {str(e)}")
        return False

def mean_pooling(model_output, attention_mask):
    """
    Mean pooling to get sentence embeddings from token embeddings.
    """
    # First element of model_output contains all token embeddings
    token_embeddings = model_output[0]
    
    # Create attention mask in the proper format
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    
    # Sum token embeddings and divide by the total number of tokens
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    
    return sum_embeddings / sum_mask

def get_embedding(text):
    """
    Get embedding for a single text string.
    """
    try:
        # Tokenize the text
        encoded_input = tokenizer(text, padding=True, truncation=True, return_tensors='pt')
        
        # Get model output
        with torch.no_grad():
            model_output = model(**encoded_input)
        
        # Apply mean pooling to get sentence embedding
        embedding = mean_pooling(model_output, encoded_input['attention_mask'])
        
        return embedding.squeeze().numpy()
    except Exception as e:
        logger.error(f"Error generating embedding for text: {str(e)}")
        return None

def compute_similarity(query_embedding, text_embedding):
    """
    Compute cosine similarity between query embedding and text embedding.
    """
    # Normalize embeddings
    query_norm = np.linalg.norm(query_embedding)
    text_norm = np.linalg.norm(text_embedding)
    
    # Check for zero norms to avoid division by zero
    if query_norm == 0 or text_norm == 0:
        return 0
    
    # Compute cosine similarity
    similarity = np.dot(query_embedding, text_embedding) / (query_norm * text_norm)
    return similarity

def semantic_search(query, threshold=0.6):
    """
    Search for questions and options semantically similar to the query.
    
    Args:
        query (str): The natural language query to search for
        threshold (float): Similarity threshold (0-1) for matching
        
    Returns:
        list: List of matching questions with similarity scores and metadata
    """
    global model, tokenizer, nlp_available
    
    # Check if NLP dependencies are available
    if not nlp_available:
        logger.warning("NLP dependencies not available, using keyword search instead")
        return keyword_search(query)
    
    # Initialize model if not already loaded
    if model is None or tokenizer is None:
        if not initialize_model():
            logger.error("Failed to initialize NLP model for search")
            # Fall back to keyword search if model initialization fails
            return keyword_search(query)
    
    try:
        logger.info(f"Performing semantic search for query: {query}")
        
        # Get embedding for query
        query_embedding = get_embedding(query)
        if query_embedding is None:
            logger.warning("Failed to generate embedding for query, falling back to keyword search")
            return keyword_search(query)
        
        # Get all questions
        questions = Question.query.all()
        options = Option.query.all()
        
        results = []
        
        # Process questions
        for question in questions:
            # Get question embedding
            question_text = question.text
            question_embedding = get_embedding(question_text)
            
            if question_embedding is not None:
                # Compute similarity
                similarity = compute_similarity(query_embedding, question_embedding)
                
                # If similarity is above threshold, add to results
                if similarity >= threshold:
                    results.append({
                        'survey_id': question.survey_id,
                        'survey_name': question.survey.name,
                        'question_id': question.id,
                        'question_number': question.question_number,
                        'text': question.text,
                        'options': [option.text for option in question.options],
                        'match_type': 'question',
                        'similarity': float(similarity)
                    })
        
        # Process options
        for option in options:
            # Get option embedding
            option_text = option.text
            option_embedding = get_embedding(option_text)
            
            if option_embedding is not None:
                # Compute similarity
                similarity = compute_similarity(query_embedding, option_embedding)
                
                # If similarity is above threshold, add to results
                if similarity >= threshold:
                    results.append({
                        'survey_id': option.question.survey_id,
                        'survey_name': option.question.survey.name,
                        'question_id': option.question_id,
                        'question_number': option.question.question_number,
                        'text': option.question.text,
                        'options': [opt.text for opt in option.question.options],
                        'match_type': 'option',
                        'matched_option': option.text,
                        'similarity': float(similarity)
                    })
        
        # Sort results by similarity score (highest first)
        results.sort(key=lambda x: x['similarity'], reverse=True)
        
        logger.info(f"Semantic search found {len(results)} results")
        return results
    
    except Exception as e:
        logger.error(f"Error in semantic search: {str(e)}")
        logger.info("Falling back to keyword search")
        return keyword_search(query)

def keyword_search(query):
    """
    Fallback function for keyword-based search when NLP model is not available.
    
    Args:
        query (str): The search query
        
    Returns:
        list: List of matching questions based on keyword search
    """
    logger.info(f"Performing keyword search for query: {query}")
    
    # Simple search implementation with ILIKE
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
    
    logger.info(f"Keyword search found {len(results)} results")
    return results