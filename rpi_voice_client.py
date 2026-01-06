import speech_recognition as sr
import os
import time
import sys

# Zvuková odezva (vyžaduje 'espeak-ng')
def speak(text):
    print(f"Robot říká: {text}")
    os.system(f"espeak-ng -vcs '{text}'")

def listen():
    """Naslouchá a rozpoznává řeč."""
    # Nahrávání zvuku přes systémový příkaz arecord
    print("Nahrávám...")
    os.system("arecord -d 3 -f cd -t wav audio.wav")
    
    r = sr.Recognizer()
    try:
        with sr.AudioFile("audio.wav") as source:
            audio = r.record(source)
            try:
                text = r.recognize_google(audio, language="cs-CZ")
                print(f"Rozpoznáno: {text}")
                return text.lower()
            except sr.UnknownValueError:
                print("Nerozpoznáno.")
                return ""
            except sr.RequestError:
                print("Chyba při komunikaci s Google API.")
                return ""
    except Exception as e:
        print(f"Chyba při nahrávání/čtení: {e}")
        return ""

def handle_command(command):
    """Zpracuje příkaz od uživatele."""
    if not command:
        return ""
        
    if "jak se jmenuješ" in command:
        speak("Jmenuji se Mark. Váš osobní asistent.")
    elif "udělej poznámku" in command:
        speak("Dobře, jakou poznámku si mám poznamenat?")
        # Tady by měla následovat logika pro uložení poznámky (API call na backend)
    elif "stop" in command or "konec" in command:
        speak("Dobře, vypínám se.")
        return "exit"
    else:
        speak("Tomu nerozumím. Zkuste to prosím znovu.")
    return ""

if __name__ == "__main__":
    print("Instalace závislostí (pokud nejsou): sudo apt-get install espeak-ng alsa-utils python3-pyaudio")
    
    speak("Asistent je spuštěn.")
    
    while True:
        print("\nČekám na příkaz (řekněte 'Marku')...")
        # V jednoduché verzi nahráváme pořád nebo na stisk klávesy. 
        # Zde pro demo "listen" nahrává 3 sekundy.
        # V ostrém provozu by zde byl hotword detection (např. Porcupine).
        
        wake_word = listen()
        
        if "marku" in wake_word or "mark" in wake_word:
            speak("Ano, poslouchám?")
            
            command = listen()
            
            if handle_command(command) == "exit":
                break
