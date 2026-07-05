var triggerError = function(){
    openPopject({ selector: 'ask-fail' });
}

var trigger = function(time,handler) {
    window.setTimeout(function(){handler();},time);
}

var apiCall = function(url,data,success,errorhandler) {
    $.ajax({
        url: url,
        type: 'POST',
        data: data,
        dataType: 'json',
        success: function(response){
            success(response);
        },
        error: function(msg){
            if (errorhandler = null) errorhandler = function(msg){ triggerError(); };
            errorhandler(msg);
        }
    })
}



$('#make-new-space').submit(function(){
        var data    = 'title='+$('#new_space_title').val()+'&'+$('#confirm').serialize();
        trigger(1000, function(){
                apiCall('/api/space/private/',data,function(response){
                    response.question = JSON.parse(response.question);
                
                    if (response.success==false) {
                        triggerError();
                        return false;
                    }

                    var id  = response.question[0].pk;
                    window.location.href="/questions/"+id+'/';
                });
            });

});