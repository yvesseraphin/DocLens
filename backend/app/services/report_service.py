from __future__ import annotations

import json
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)
_MODEL = "llama-3.3-70b-versatile"

_SYSTEM_INSTRUCTION = """You are writing an AI-assisted signature analysis report for a non-technical reviewer.

The computer-vision pipeline compared a questioned signature with reference specimens. Explain the measured evidence without presenting the result as legal proof or as a probability of authenticity.

STRICT RULES:
1. Never change the verdict field.
2. Write 5 to 7 sentences of plain prose. No bullets, headings, markdown, or numbered lists.
3. Refer to the score as a similarity score, never as a probability or calibrated confidence.
4. Explain the measured feature differences supplied in the analysis result. Do not invent findings.
5. Explain the detection mode as a software-observed pattern, not a definitive finding about who created the signature.
6. Mention how many reference specimens were compared and the best similarity score.
7. Do not use technical model jargon such as cosine similarity, embedding, ResNet, or Grad-CAM.
8. Do not claim the software can establish forgery, authorship, intent, or repudiation by itself.
9. If the similarity score is close to the 75% threshold, explicitly recommend manual document-examiner review.
10. End with a clear, proportionate recommendation."""


def _fallback_report(verdict: str, confidence: int, best_similarity: float, flagged_regions: List[str], detection_mode: str, reference_count: int, per_ref_scores: Optional[List[int]] = None) -> str:
    score_pct = int(round(best_similarity * 100))
    verdict_phrase = "was classified as a matching signature pattern" if verdict.upper() == "GENUINE" else "was classified as a non-matching signature pattern"
    if flagged_regions:
        regions = flagged_regions[0] if len(flagged_regions) == 1 else ", ".join(flagged_regions[:-1]) + f", and {flagged_regions[-1]}"
    else:
        regions = "the measured signature features"
    if score_pct >= 75:
        action = "Routine verification should still be retained for consequential decisions."
    elif 65 <= score_pct < 75:
        action = "Because the result is close to the decision threshold, manual review by a qualified document examiner is recommended."
    else:
        action = "The result should be independently reviewed by a qualified document examiner before any consequential decision is made."
    return (
        f"The questioned signature {verdict_phrase} with a similarity score of {score_pct}% against the available reference specimens. "
        f"The analysis compared {reference_count} reference specimen{'s' if reference_count != 1 else ''} and observed differences in {regions}. "
        f"These measurements describe visual and structural differences detected by the software and should not be treated as standalone proof of forgery or authorship. "
        f"The software's pattern classification was {detection_mode}, which indicates how the measured evidence was interpreted by the pipeline. "
        f"The reported decision score is a similarity measure rather than a calibrated probability of authenticity. {action}"
    )


async def generate_written_report(verdict: str, confidence: int, similarity_score: float, threshold: float, detection_mode: str, flagged_regions: List[str], reference_count: int, key_differences: Optional[List[dict]] = None, per_ref_scores: Optional[List[int]] = None, feature_scores: Optional[List[dict]] = None) -> str:
    from app.config import settings
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — using fallback report template.")
        return _fallback_report(verdict, confidence, similarity_score, flagged_regions, detection_mode, reference_count, per_ref_scores)

    payload = {
        "verdict": verdict.upper(),
        "similarity_score_percent": confidence,
        "similarity_threshold_percent": round(threshold * 100, 1),
        "detection_mode": detection_mode,
        "reference_samples_compared": reference_count,
        "per_reference_similarity_scores": per_ref_scores or [],
        "key_differences_detected": [{"feature": kd.get("label", ""), "impact": kd.get("impact", "")} for kd in (key_differences or [])],
        "per_feature_difference_scores": feature_scores or [],
    }
    user_prompt = "Write the AI-assisted report narrative for the following signature analysis result. Explain the measured features and practical meaning without claiming legal or forensic certainty.\n\n" + f"ANALYSIS RESULT:\n{json.dumps(payload, indent=2)}"
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model=_MODEL,
            messages=[{"role": "system", "content": _SYSTEM_INSTRUCTION}, {"role": "user", "content": user_prompt}],
            max_tokens=1024,
            temperature=0.2,
        )
        text = (response.choices[0].message.content or "").strip()
        if len(text.split()) < 40:
            logger.warning("Groq response too short — using fallback.")
            return _fallback_report(verdict, confidence, similarity_score, flagged_regions, detection_mode, reference_count, per_ref_scores)
        return text
    except ImportError:
        logger.warning("groq package not installed — using fallback report.")
        return _fallback_report(verdict, confidence, similarity_score, flagged_regions, detection_mode, reference_count, per_ref_scores)
    except Exception as exc:
        logger.error("Groq API call failed: %s — using fallback report.", exc)
        return _fallback_report(verdict, confidence, similarity_score, flagged_regions, detection_mode, reference_count, per_ref_scores)
