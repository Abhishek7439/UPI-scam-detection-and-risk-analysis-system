import urllib.request
import json
import base64

def run():
    print("Starting...")
    try:
        with open('QR.jpeg', 'rb') as f:
            qr_b64 = base64.b64encode(f.read()).decode('utf-8')
    except Exception as e:
        print("Failed to read QR:", e)
        return
        
    print("QR loaded, length:", len(qr_b64))
    
    payload = json.dumps({
        'text': '',
        'url': '',
        'upi_id': '',
        'qr_image': qr_b64
    }).encode('utf-8')
    
    req = urllib.request.Request(
        'http://127.0.0.1:8000/analyze',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    
    print("Sending request...")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            for line in response:
                decoded = line.decode('utf-8').strip()
                if decoded.startswith('data: '):
                    try:
                        data = json.loads(decoded[6:])
                        if data.get('type') == 'step':
                            print(f"STEP: {data['step']['step']} -> {data['step'].get('status', '')}")
                        elif data.get('type') == 'final':
                            print("\n=== FINAL VERDICT ===")
                            print(f"Verdict: {data.get('verdict')}")
                            print(f"Signals: {data.get('signals')}")
                    except Exception as e:
                        print("Parse err:", e)
    except Exception as e:
        print("Request failed:", e)

if __name__ == '__main__':
    run()
