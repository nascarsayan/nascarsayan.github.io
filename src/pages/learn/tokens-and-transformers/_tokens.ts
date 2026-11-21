/**
 * Real output of the gpt-oss-120b tokenizer (o200k_harmony, Hugging Face tokenizer.json),
 * generated offline from the published tokenizer.
 */
export interface Tok { id: number; text: string }
export const sentences: { text: string; tokens: Tok[] }[] = [{"text": "The GPU node is ready.", "tokens": [{"id": 976, "text": "The"}, {"id": 47969, "text": " GPU"}, {"id": 4596, "text": " node"}, {"id": 382, "text": " is"}, {"id": 6977, "text": " ready"}, {"id": 13, "text": "."}]}, {"text": "Kubernetes schedules Pods onto nodes.", "tokens": [{"id": 42, "text": "K"}, {"id": 57796, "text": "ubernetes"}, {"id": 50216, "text": " schedules"}, {"id": 113706, "text": " Pods"}, {"id": 13291, "text": " onto"}, {"id": 15749, "text": " nodes"}, {"id": 13, "text": "."}]}, {"text": "kubectl get pods -n", "tokens": [{"id": 101343, "text": "kub"}, {"id": 128385, "text": "ectl"}, {"id": 717, "text": " get"}, {"id": 88596, "text": " pods"}, {"id": 533, "text": " -"}, {"id": 77, "text": "n"}]}, {"text": "MI355X", "tokens": [{"id": 15470, "text": "MI"}, {"id": 31081, "text": "355"}, {"id": 55, "text": "X"}]}];
/** Candidate next tokens used in the toy unembedding (one token each). */
export const candidates: Tok[] = [{"id": 1225, "text": " It"}, {"id": 623, "text": " The"}, {"id": 2545, "text": " All"}, {"id": 1608, "text": " You"}, {"id": 279, "text": "\n\n"}, {"id": 113706, "text": " Pods"}];
