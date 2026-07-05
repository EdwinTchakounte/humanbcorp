var allUsers = [];
var participants = [];
var panier= {};
var panier_show_list = {};

class connectedClass 
{
   constructor() {  }
  
  // Static properties shared by all instances
	  static firstTimeConnected = 0;

	  static  getFirstTimeConnected() 
	  {
	    return this.firstTimeConnected;
	  }
	  
	  static setFirstTimeConnected(conn) 
	  {
	    this.firstTimeConnected = conn;
	  }
	  
}

 //var myConnectedClass = new connectedClass();

/* On Dom Ready */
$(function() {


// to set Panier after first login
 loadCartAfterLogin();


  //$('#error').click(hideError);
  $('#panier').click(function(){ 
     
      showCart();  
   
   });
   
   
         
         AfficherList();
        
        
   
   
});


function loadCartAfterLogin()
{
  
	
	if( $('#connected_user').val() == 1  )
	{
	    
	    if( connectedClass.getFirstTimeConnected() == 0 )
	    {
	    	loadIncriptionsToCart();
	    	
	       connectedClass.setFirstTimeConnected(1);
	    }


	}
	else
	{

	   // connectedClass.setFirstTimeConnected(0)
	}

}

function loadIncriptionsToCart()
{
	
	$.ajax({
		    url: '/bucket/ajax_get_cart_data', 
		    dataType: 'json',
		    async: false,
		    type: 'GET',
		    success: function(data) {

		               if( data != null && data.length > 0 ) 
		               {
		               	$.each(data, function(key, value) {
		               	
		               		participant_id = data[key]["participant"];
		               		datap = data[key]["publications"];
		               		$.each(datap, function(keyp, valuep) {
		               		
		               			pub_id = datap[keyp]["id"];
		               			
		               			if( Array.isArray(panier[pub_id]) )
		               			{
		               				if( panier[pub_id].includes(participant_id) == false )
		               				{
		               					panier[pub_id].push(participant_id.toString()); 
		               				}
		               			}
		               			else
		               			{
		               				panier[pub_id] = [participant_id.toString()];
		               			
		               			}
		               			
		               		
		               		});
		               	
		               	
		               	});
		               
		               }
		               else
		               {
		               	panier= {};
		               }
		               
		               localStorage.setItem('panier', JSON.stringify(panier));
		               document.getElementById("panier").innerHTML ="Cart("+ Object.keys(panier).length+")";	
			       
		   },
		   
		    error: function (xhr,textStatus,errorThrown) {
                              console.log("ERROR : ", errorThrown);
			       console.log("ERROR : ", xhr);
			       console.log("ERROR : ", textStatus);
		       }
	    });  
	
	


}




function AfficherList()
        {
            $('#cart-infos').empty();
            var panierString = " ";
           
          //  $('#cart-infos').append("<h5> Your list </h5>");
           // var index = 1;
            
            		if( localStorage.getItem('panier') == null )
    		        {
    		        	panier_show_list = {};
    		        
    		        }
    		        else
    		        {
    		        	panier_show_list = JSON.parse(localStorage.getItem('panier'));
    		           		        
    		        }
                    
            
            $('#cart-infos').prepend("<a href='/bucket/cart/' class='btn btn-brand'>Checkout</a>");
            for(var x in panier_show_list)
            {
                //alert(x);
               // panierString += index;
                
                $.getJSON('/publications/ajax_get_publication/'+x, function(json) {  // alert("--- publication---"); alert(json['title']);
	   	
	     			//$('#participant_username_'+ participant_id ).text(json['username'].toString());
	    		 	panierString = '<div class="container" style="background-color: #efefef;">'; 
	    		 	 
	    		 		panierString += '<h5 style="color:var(--brand);"> '+ json['title'] +'</h5>';
	    		 		panierString += '<div id="allParticipantsFrom_'+json['id']+'" style="background-color:#fff; margin-bottom:10px;" class="row">';
	    		 		         
	    		 		        
				
	    		 		panierString += '</div>';  
	    		 	
	    		 	 panierString += '</div>';  
	    		 	
	    		 	 $('#cart-infos').prepend(panierString);
	    		 	  loadAllParticipantsFrom(json['id']);
	    		 	 		 	 
	    	
		});
                
                //panierString += document.getElementById("aa"+x).innerHTML + " Qte: "+ panier[x][0] + "</br>";
                //index +=1;
            } 
           
           // $('[data-bs-toggle="popover"]').popover();
            //document.getElementById('panier').setAttribute('data-bs-content', panierString);
           
        }
        


function loadAllParticipantsFrom(x)
{
      
	 for(p=0;  p < panier_show_list[x].length; p=p+1)
	  { 
	       //alert("--- participe---");
	       //alert(panier[x][p]);	 		                

		$.getJSON('/registration/ajax_get_user/'+ panier_show_list[x][p], function(json) {
							 
			$('#allParticipantsFrom_'+x).append('<h6>'+ json['username'] +'</h6>');
										 
		});
	 }
	 

}	


function showCart() 
{

	  if( $('#cart-infos').is(':visible') ) 
	  {
	    //$('#panier').removeClass('selected');
	    $('#cart-infos').slideUp('fast');
	    
	   
	  } 
	  else 
	  {
	        
	       
                   // show cart infos
		    pos = $('#panier').position();		    
		    $('#panier').addClass('selected');
		    $('#cart-infos').css({'top' : pos.top + $('#panier').innerHeight() + 5 ,  'left' : pos.left - 1});
		    $('#cart-infos').slideDown('fast');
		   
	  }
	  
}






function close_modal(selector)
{
   $(".modal-backdrop").remove();
   $(selector).modal('hide');

}

function show_modal(selector)
{
   $(selector).modal({backdrop: true});
   $(selector).modal('show');

}




function isInputEmpty(selector) 
{
  return $(selector).attr('value').trim().length == 0;
}



function removeNonWordChars(string) 
{
  return string.replace(/[^\w]/gi, '');
}



function post_ajax_form(selector, url, value , type)
{  
      
          
			 
			 $.ajax({
			    type: 'POST',
			    url: url,
			    data: value,
			    dataType: 'json',
			    success: function (json) {
				switch (type) {
				    case 0:
					// Réinitialiser le formulaire et masquer les sections
					$('#register_participant_form')[0].reset();
					$('#show_user_register').hide();
					$('#selectParticipants').hide();
					$('#add_new_participant_div').hide();
					$('#button_new').hide();
                         		$('#button_exist').hide();

					// Ajouter le participant créé
					addParticipantLine(json.id, json.username, '#participants');
					break;

				    case 1:
					// Si succès, redirection
					if (json.success === true) {
					    window.location.href = "/calendarapp/event/themes/";
					}
					break;

				    case 2:
					// Réinitialiser le formulaire répétitif
					$('#repeated_time_div').hide();
					$('#repeated_time_form')[0].reset();
					window.location.reload();
					break;

				    case 3:
					return json.success;
					
				    case 4:
					close_modal('#modal-participant-to-add');
					break;

				    default:
					console.warn("Type de requête non reconnu :", type);
					break;
				}
			    },
			    error: function (xhr, errmsg, err) {
				console.error("Erreur AJAX :", xhr.status + " → " + xhr.responseText);
			    }
			});
			




}




function initAutocomplete(selector, url, value) 
{
    let results = get_ajax_users_json(url, value);
    search_autocomplete(selector, results); 
     
}




function search_autocomplete(selector, results)
{
   alert(results);
   $(selector).autocomplete({ source: results  });   
    
}





function get_ajax_users_json(selector, url, value , type)
{

    let results = []; 
     $.ajax({
            url: url,
            data: {
              'username_query': value 
            },
            dataType: 'json',
            success: function (data) 
            {
               //alert(selector);
               results = data;
               switch (type) 
               {
		  case 0:
		  	allUsers = results;
		    	break;
		  case 1:
		   	 $("#search_participants").autocomplete({ source: results  });  
		   	 break;
		
		}
            }
        });   
  return results;
}


