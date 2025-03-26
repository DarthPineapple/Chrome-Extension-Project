document.getElementById("optionsForm").addEventListener('submit', function(event){
    event.preventDefault();
    console.log('Submitted');
    let color = document.getElementById('bgColor').value;
    chrome.storage.sync.set({'backgroundColor':color}, 
        function(){
        console.log('Background color saved');
    })
})