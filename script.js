document.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('bg-audio');
  const logo = document.getElementById('logo');
  const overlay = document.getElementById('overlay');
  const playBtn = document.getElementById('play-btn');
  const presentationState = {
    stepIndex: 0,
    stepName: 'waiting',
    lastUpdated: Date.now(),
  };
  window.presentationState = presentationState;
  function updateStep(stepName) {
    presentationState.stepIndex += 1;
    presentationState.stepName = stepName;
    presentationState.lastUpdated = Date.now();
    document.dispatchEvent(new CustomEvent('presentation-step-changed', { detail: presentationState }));
    console.debug('presentation step:', presentationState);
  }

  function startSequence() {
    updateStep('start-sequence');
    overlay.classList.add('hidden');
    // start animation
    logo.classList.remove('idle');
    logo.classList.add('animate');
    updateStep('logo-launch');
    // Prepare hand trigger function (will run 2s after the fart ends)
    const hand1Wrap = document.getElementById('hand1-wrap');
    const hand1Art = hand1Wrap ? hand1Wrap.querySelector('.hand-art') : null;
    const hand1 = hand1Wrap ? hand1Wrap.querySelector('.hand-img') : null;
    const thisis = document.getElementById('thisis-audio');
    function triggerHand() {
      const notvery = document.getElementById('notvery-audio');
      const loser = document.getElementById('loser-audio');
      const hand2Wrap = document.getElementById('hand2-wrap');
      const hand2Art = hand2Wrap ? hand2Wrap.querySelector('.hand-art') : null;
      const hand2 = hand2Wrap ? hand2Wrap.querySelector('.hand-img') : null;
      if (hand1Wrap && hand1) {
        updateStep('right-hand-initial');
        hand1Wrap.classList.add('pop-right');
        setTimeout(() => {
          if (hand1Art) hand1Art.classList.add('point');
          if (thisis) thisis.addEventListener('ended', () => { if (hand1Art) hand1Art.classList.remove('point'); }, { once: true });
          // after waving completes, have the hand exit stage-right instead of disappearing
          setTimeout(() => {
            if (hand1) hand1.classList.remove('wave');
            if (hand1Wrap) {
              hand1Wrap.classList.remove('pop-right');
              hand1Wrap.classList.add('exit-right');
            }
          }, 2800); // slightly shorter wave period for snappier motion
        }, 700);
      }
      if (thisis) {
        updateStep('thisismy');
        thisis.currentTime = 0;
        thisis.play().catch(() => { console.warn('thisismy.wav playback blocked'); });
        // After thisis finishes, trigger hand2 after 0.5s to play `notvery`
        if (thisis) {
          thisis.addEventListener('ended', () => {
            setTimeout(() => {
              // animate hand2 in from left
              if (hand2Wrap && hand2) {
                updateStep('left-hand-notvery');
                hand2Wrap.classList.add('pop-left');
                setTimeout(() => {
                  if (hand2Art) hand2Art.classList.add('poke');
                  if (notvery) notvery.addEventListener('ended', () => { if (hand2Art) hand2Art.classList.remove('poke'); }, { once: true });
                }, 700);
                // have hand2 exit left after a short time
                setTimeout(() => { if (hand2) hand2.classList.remove('wave'); if (hand2Art) hand2Art.classList.remove('shake'); if (hand2Wrap) { hand2Wrap.classList.remove('pop-left'); hand2Wrap.classList.add('exit-left'); } }, 2800);
              }
              if (notvery) {
                notvery.currentTime = 0;
                notvery.play().catch(() => { console.warn('notvery playback blocked'); });
                updateStep('notvery');
              }
              // After notvery ends and hand2 exits, bring hand1 back in to play trying.wav
              if (notvery) {
                notvery.addEventListener('ended', () => {
                  // small delay to allow hand2 exit animation to finish
                  setTimeout(() => {
                    const trying = document.getElementById('trying-audio');
                    // re-enter right hand
                    if (hand1Wrap && hand1 && hand1Art) {
                      // reset exit class if present
                      hand1Wrap.classList.remove('exit-right');
                      // ensure it's off-screen then pop in
                      hand1Wrap.classList.add('pop-right');
                      setTimeout(() => {
                        if (hand1Art) hand1Art.classList.add('point');
                        if (trying) {
                          trying.currentTime = 0;
                          trying.play().catch(() => { console.warn('trying playback blocked'); });
                          updateStep('trying');
                          trying.addEventListener('ended', () => {
                            if (hand1Art) hand1Art.classList.remove('point');
                            if (loser) {
                              setTimeout(() => {
                                if (hand2Wrap && hand2 && hand2Art) {
                                  hand2Wrap.classList.remove('exit-left');
                                  hand2Wrap.classList.add('pop-left');
                                  updateStep('left-hand-loser');
                                  setTimeout(() => {
                                    if (hand2Art) {
                                      hand2Art.classList.add('poke');
                                      hand2Art.classList.add('bounce');
                                    }
                                    loser.currentTime = 0;
                                    loser.play().catch(() => { console.warn('loser playback blocked'); });
                                    loser.addEventListener('ended', () => {
                                      if (hand2Art) {
                                        hand2Art.classList.remove('poke');
                                        hand2Art.classList.remove('bounce');
                                      }
                                      updateStep('loser');
                                      if (hand2Wrap) {
                                        hand2Wrap.classList.add('exit-left');
                                      }
                                    }, { once: true });
                                  }, 700);
                                }
                              }, 700);
                            }
                          }, { once: true });
                        }
                        // after this line, exit-right
                        setTimeout(() => { if (hand1Wrap) { hand1Wrap.classList.remove('pop-right'); hand1Wrap.classList.add('exit-right'); } }, 2200);
                      }, 800);
                    }
                  }, 700);
                }, { once: true });
              }
            }, 500);
          }, { once: true });
        }
      }
    }

    // after floatUp finishes, switch to gentle idle bobbing and swap audio
    const onAnimEnd = (e) => {
      if (e.animationName === 'floatUp') {
        // Ensure the logo stays visible after the "floatUp" animation
        try { logo.style.opacity = '1'; } catch (err) {}

        logo.classList.remove('animate');
        logo.classList.add('idle');
        logo.removeEventListener('animationend', onAnimEnd);
        updateStep('logo-settled');

        // stop background audio and play the proud-fart audio; when fart ends trigger the hand after 2s
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (err) {}
        const fart = document.getElementById('fart-audio');
        if (fart) {
          updateStep('proud-fart');
          fart.currentTime = 0;
          fart.play().then(() => {
            fart.addEventListener('ended', () => { setTimeout(triggerHand, 2000); }, { once: true });
          }).catch(() => {
            // couldn't play fart; still trigger hand after 2s
            setTimeout(triggerHand, 2000);
          });
        } else {
          setTimeout(triggerHand, 2000);
        }
      }
    };
    logo.addEventListener('animationend', onAnimEnd);

    // attempt to play audio (ignored if already playing)
    audio.play().catch(() => {});

    // (fart playback and hand triggering are handled in the animation end handler)
  }

  // Try autoplay; if blocked, show play button overlay
  audio.play().then(() => {
    startSequence();
  }).catch(() => {
    overlay.classList.remove('hidden');
    playBtn.focus();
  });

  playBtn.addEventListener('click', () => {
    audio.play().then(() => startSequence()).catch(() => {});
  });
});
