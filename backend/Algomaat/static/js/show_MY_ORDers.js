var NumberOfContents = 0;
$(function () { 
	 
	 
	$('#tranche_name_form').on('change', function() {
  		if( this.value == 4 )
  		{
  		     $('#montant_tranche_form').hide();
  		}
  		else
  		{
  		    $('#montant_tranche_form').show();
  		}
	});
	 
	 
	 
		$.ajax({
		    url: '/paiement/ajax_get_order_data', 
		    dataType: 'json',
		    async: false,
		    type: 'GET',
		    success: function(data) {
		              
		              addOrders(data) 
			       
		   },
		   
		    error: function (xhr,textStatus,errorThrown) {
                              console.log("ERROR : ", errorThrown);
			       console.log("ERROR : ", xhr);
			       console.log("ERROR : ", textStatus);
		       }
		  });  
	
	          
	      	
 /*$('#close2').click(function(){
	 
              $(".modal-backdrop").remove();
	      $('#modal-pub-to-link').modal('hide');
	 });  
	   */
	   


    $('#convertToSpace').click(function(){
	
 	

  	});
              
                            
 

	
	
});


function deleteLineClick(eventObject) {
  divObj = $('#' + eventObject.currentTarget.id).parent().parent().parent();
  id = divObj.attr('id');

  url = "/bucket/remove/publication/"+id;
  $.getJSON(url, function(json) {
				 	     					
	if(json.success)
	{
	   
	    divObj.hide('fast', function(){ $(this).remove(); NumberOfContents--; });
	    if(NumberOfContents == 0)
	    {
	        $('#convertToSpace').hide();
	    	
	    }
				 	     						
        }
	else
	{
		
				 	     					  
        } 

  });
  return false;
}







function addContentsOrder(Data, order_id)
{
   $('#allContents').empty();
                        var total_price = 0;
		         if( Data != null && Data.length > 0 ) 
		         { 
		   		
		        content =  '<div id="" class="container" style="background-color:#fff; width:97%; margin:10px;" >';        
                
                             content += '<table style="background-color:#efefef; width:97%; margin:10px;" class="bordered-table zebra-striped">';
						content +='<thead>';
						content +='<tr>';
						content +='<th> Inscription State </th>';
						content +='<th> Participant </th>';
						content +='<th>Publication</th>';
						content +='<th>Price</th>';
						//content +='<th> Buy </th>';
						content +='<th> Calender </th>';
						content +='</tr>';
						content +='</thead>';
						content +='<tbody>';
		                               
		         		  	$.each(Data , function(key2, value) 
	 	                 			{ 
	 	                 				var inscriptionState = "Waiting";

								if( Data[key2]["status"] == 2 )
								{
								   inscriptionState = "Confirmed";
								}
								else if( Data[key2]["status"] == 3 )
								{
								   inscriptionState = "Cancel";
								}
						  	content +='<tr>';
						  	       content +='<td>'+ inscriptionState +'</td>';
						  	
						  	
						    		content +='<td>'+ Data[key2]["participant_name"]  +'</td>';
						    		DataPublications = Data[key2]["publications"];
						    		content += '<td>';
							  	$.each(DataPublications , function(key3, value) 
		 	                 			{ 
						    	          content +='<span>'+ DataPublications[key3]["title"] +'</span>';
						    		});
						    		content +='</td>';
						    		content += '<td>';
							  	$.each(DataPublications , function(key3, value) 
		 	                 			{ 
						    	          content +='<span>'+ DataPublications[key3]["price"] +'EUR</span>';
						    	          
						    		});
						    		content +='</td>';
								/*content +='<td>';
						    		if( orderState == "Pending" )
						    		{
			content +='<span id=""  class="btn btn-brand bx bxs-purchase-tag" style="margin:1px;" > </span>';
						    		}
						    		content +='</td>'; */
						    		content +='<td><span id=""  class="btn btn-brand bx bxs-calendar" style="margin:1px;" > </span> </td>';
						    	content +='</tr>';
						    	});
						    	        
						  	
			              
				 	//$('#delete_' + Data2[key3]["id"]).click(deleteLineClick);	     			
		       	 
						content +='</tbody>';
				content +='</table>';
				 
			     content +='</div>';
		  	  $('#allContents_'+ order_id).append(content);

				 	
		         }
}





function addOrders(data) 
{
	 if( data != null && data.length > 0 ) 
	 {
		     $.each(data , function(key, value) 
		     {
		 	order =  '<div id="order" class="container" style="background-color: #DAD7CD;  margin-bottom:50px;" >';
				  
			     				
				order += '<h3 style="color:var(--brand);">'+ data[key]["totalOrderPrice"] +' EUR</h3>';
				order += '<input type="hidden" id="total_price_order_'+ data[key]["id"]+'" name="montant" value="'+ data[key]["totalOrderPrice"] +'">';
				
				var status = "Pending";
				if( data[key]["status"] == 2 )
				{
				   status = "Total_Paid";
				}
				else if( data[key]["status"] == 3 )
				{
				   status = "Partially_Paid";
				}
				
				if( data[key]["status"] == 4 )
				{
				    status = "Failed";
				}
				
      order +='<span id=""  class="btn btn-brand" style="margin:1px; float:left;" ><b>'+ status +'</b> </span>';
	                      if( status == "Pending" )
				{
			order +='<span id=""  class="btn btn-brand bx bxs-purchase-tag" style="margin:1px; float:right;" data-bs-toggle="modal" data-bs-target="#modal-paiement" onclick="show_paiement('+ data[key]["id"]  +')" > </span>';
				}
				else  if( status == "Partially_Paid" )
				{
			order +='<span id=""  class="btn btn-brand bx bxs-purchase-tag" style="margin:1px; float:right;" data-bs-toggle="modal" data-bs-target="#modal-paiement" onclick="redirect_paiement('+ data[key]["id"]  +')" > </span>';
				}
				
				
			      	order += '<br>';
				order += '<div id="allContents_'+ data[key]["id"]+'"  style=" padding-bottom:20px;" class="row g-4">';
								
								
								
					 	     		
			       order += '</div>';
		    order += '</div>';
		 

			$('#contentsOfOrders').append(order);    
			addContentsOrder(data[key]["inscriptions"], data[key]["id"]);   
			$('#paiement').fadeIn('fast'); 	
		 	
							
		    });
		
	  }
  
}




