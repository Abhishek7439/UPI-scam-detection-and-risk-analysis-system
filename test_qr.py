import base64
import json
import httpx
import sys

def run_test():
    try:
        with open('QR.jpeg', 'rb') as f:
            qr_b64 = base64.b64encode(f.read()).decode('utf-8')
    except Exception as e:
        print("Error reading QR.jpeg:", e)
        return

    payload = {
        'text': '',
        'url': '',
        'upi_id': '',
        'qr_image': qr_b64
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            with client.stream('POST', 'http://localhost:8000/analyze', json=payload) as response:
                for line in response.iter_lines():
                    if line.startswith('data: '):
                        data = json.loads(line[6:])
                        if data.get('type') == 'step':
                            step = data['step']
                            st = step.get('status', '').upper()
                            name = step.get('step', '')
                            print(f'[{st}] {name}')
                            if st == 'DONE':
                                print(f'  -> {step.get("result")}')
                        elif data.get('type') == 'final':
                            print('\n=== FINAL VERDICT ===')
                            print(f'Verdict: {data.get("verdict")}')
                            print(f'Explanation: {data.get("explanation")}')
                            print('Signals:')
                            for sig in data.get('signals', []):
                                print(f'  - [{sig.get("severity")}] {sig.get("source")}: {sig.get("signal")}')
    except Exception as e:
        print("Error calling API:", e)

if __name__ == '__main__':
    run_test()
